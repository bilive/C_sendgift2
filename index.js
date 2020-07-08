"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = __importStar(require("../../plugin"));
class SendGift extends plugin_1.default {
    constructor() {
        super();
        this.name = '自动送礼2';
        this.description = '自动清空在指定时间内的礼物';
        this.version = '0.1.0';
        this.author = 'ShmilyChen';
    }
    async load({ defaultOptions, whiteList }) {
        defaultOptions.newUserData['sendGift'] = false;
        defaultOptions.info['sendGift'] = {
            description: '自动送礼',
            tip: '自动送出剩余时间不足24小时的礼物',
            type: 'boolean'
        };
        whiteList.add('sendGift');
        defaultOptions.newUserData['sendGiftUids'] = [];
        defaultOptions.info['sendGiftUids'] = {
            description: '自动送礼uid',
            tip: '要自动送出礼物的主播uid,多个请用以\",\"间隔分割',
            type: 'numberArray'
        };
        whiteList.add('sendGiftUids');
        defaultOptions.newUserData['sendGiftDay'] = 7;
        defaultOptions.info['sendGiftDay'] = {
            description: '自动送礼多少天内的礼物',
            tip: '自动送出礼物在多少天内过期的礼物',
            type: 'number'
        };
        whiteList.add('sendGiftDay');
        defaultOptions.newUserData['sendGiftRoom'] = 0;
        defaultOptions.info['sendGiftRoom'] = {
            description: '自动送礼房间',
            tip: '要自动送出礼物的房间号',
            type: 'number'
        };
        whiteList.add('sendGiftRoom');
        this.loaded = true;
    }
    async start({ users }) {
        this._sendGift(users);
    }
    async loop({ cstMin, cstHour, cstString, users }) {
        if (cstMin === 30 && cstHour % 8 === 4 || cstString === '13:55' || cstString === '23:55')
            this._sendGift(users);
    }
    _sendGift(users) {
        users.forEach(async (user) => {
            if (!user.userData['sendGift'])
                return;
            const bagList = await this.getBagInfo(user);
            await this.sendGiftByMedal(user, bagList);
            if (user.userData['sendGiftRoom'] === 0)
                return;
            const roomID = user.userData.sendGiftRoom;
            const room = {
                url: `https://api.live.bilibili.com/room/v1/Room/mobileRoomInit?id=${roomID}}`,
                responseType: 'json'
            };
            const roomInit = await plugin_1.tools.XHR(room, 'Android');
            if (roomInit !== undefined && roomInit.response.statusCode === 200) {
                if (roomInit.body.code === 0) {
                    const mid = roomInit.body.data.uid;
                    const room_id = roomInit.body.data.room_id;
                    for (const giftData of bagList) {
                        if (giftData.expireat > 0 && giftData.expireat < 24 * 60 * 60 && giftData.gift_num > 0) {
                            await this.sendGift(mid, giftData.gift_id, giftData.gift_num, giftData.id, room_id, user);
                        }
                    }
                }
                else
                    plugin_1.tools.Log(user.nickname, '自动送礼', '房间信息', roomInit.body);
            }
            else
                plugin_1.tools.Log(user.nickname, '自动送礼', '房间信息', '网络错误');
        });
    }
    async sendGift(mid, gift_id, gift_num, bag_id, room_id, user) {
        if (mid === user.biliUID)
            return false;
        const send = {
            method: 'POST',
            url: `https://api.live.bilibili.com/gift/v2/live/bag_send?${plugin_1.AppClient.signQueryBase(user.tokenQuery)}`,
            body: `uid=${user.uid}&ruid=${mid}&gift_id=${gift_id}&gift_num=${gift_num}&bag_id=${bag_id}&biz_id=${room_id}&rnd=${plugin_1.AppClient.RND}&biz_code=live&jumpFrom=21002`,
            responseType: 'json',
            headers: user.headers
        };
        const sendBag = await plugin_1.tools.XHR(send, 'Android');
        if (sendBag !== undefined && sendBag.response.statusCode === 200) {
            if (sendBag.body.code === 0) {
                const sendBagData = sendBag.body.data;
                plugin_1.tools.Log(user.nickname, '自动送礼', `向房间 ${room_id} 赠送 ${sendBagData.gift_num} 个${sendBagData.gift_name}`);
            }
            else
                plugin_1.tools.Log(user.nickname, '自动送礼', sendBag.body);
        }
        else
            plugin_1.tools.Log(user.nickname, '自动送礼', '网络错误');
        await plugin_1.tools.Sleep(3000);
        return true;
    }
    async getBagInfo(user) {
        const bag = {
            url: `https://api.live.bilibili.com/gift/v2/gift/m_bag_list?${plugin_1.AppClient.signQueryBase(user.tokenQuery)}`,
            responseType: 'json',
            headers: user.headers
        };
        const bagInfo = await plugin_1.tools.XHR(bag, 'Android');
        if (bagInfo !== undefined && bagInfo.response.statusCode === 200) {
            if (bagInfo.body.code === 0) {
                return bagInfo.body.data;
            }
            else {
                plugin_1.tools.Log(user.nickname, '自动送礼', '包裹信息', bagInfo.body);
            }
        }
        return new Array();
    }
    async getMedalList(user) {
        const medalList = {
            url: `https://api.live.bilibili.com/i/api/medal?page=1&pageSize=25`,
            responseType: 'json',
            jar: user.jar
        };
        const medalListInfo = await plugin_1.tools.XHR(medalList);
        let fansMedalList = new Array();
        if (medalListInfo !== undefined && medalListInfo.response.statusCode === 200) {
            if (medalListInfo.body.code === 0) {
                medalListInfo.body.data.fansMedalList.sort((a, b) => a.level - b.level);
                const uids = user.userData['sendGiftUids'];
                uids.forEach((uid) => {
                    medalListInfo.body.data.fansMedalList.forEach((fansMedal) => {
                        if (fansMedal.level % 20 === 0)
                            return;
                        if (uid === fansMedal.target_id) {
                            if (fansMedal.status === 1) {
                                fansMedalList.unshift({
                                    feedNum: fansMedal.day_limit - fansMedal.today_feed,
                                    mid: fansMedal.target_id,
                                    roomid: fansMedal.roomid
                                });
                            }
                            else {
                                fansMedalList.push({
                                    feedNum: fansMedal.day_limit - fansMedal.today_feed,
                                    mid: fansMedal.target_id,
                                    roomid: fansMedal.roomid
                                });
                            }
                        }
                    });
                });
                medalListInfo.body.data.fansMedalList.forEach((fansMedal) => {
                    if (uids.indexOf(fansMedal.target_id) < 0)
                        if (fansMedal.status === 1) {
                            fansMedalList.unshift({
                                feedNum: fansMedal.day_limit - fansMedal.today_feed,
                                mid: fansMedal.target_id,
                                roomid: fansMedal.roomid
                            });
                        }
                        else {
                            fansMedalList.push({
                                feedNum: fansMedal.day_limit - fansMedal.today_feed,
                                mid: fansMedal.target_id,
                                roomid: fansMedal.roomid
                            });
                        }
                });
            }
            else {
                plugin_1.tools.Log(user.nickname, '勋章信息', medalListInfo.body);
            }
        }
        return fansMedalList;
    }
    async sendGiftByMedal(user, bagList) {
        const medalInfo = await this.getMedalList(user);
        for (const medal of medalInfo) {
            if (medal.mid === user.biliUID)
                continue;
            if (medal.feedNum === 0)
                continue;
            for (const bag of bagList) {
                if (bag.gift_num === 0)
                    continue;
                if (bag.expireat <= 0 || bag.expireat > user.userData['sendGiftDay'] * 24 * 60 * 60)
                    break;
                if (bag.gift_id !== 1 && bag.gift_id !== 6)
                    continue;
                let gift_value = 0;
                switch (bag.gift_id) {
                    case 1:
                        gift_value = 1;
                        break;
                    case 6:
                        gift_value = 10;
                        break;
                }
                let send_num = Math.floor(medal.feedNum / gift_value);
                if (send_num >= bag.gift_num)
                    send_num = bag.gift_num;
                if (send_num > 0) {
                    const flog = await this.sendGift(medal.mid, bag.gift_id, send_num, bag.id, medal.roomid, user);
                    if (flog) {
                        bag.gift_num -= send_num;
                        medal.feedNum -= send_num * gift_value;
                    }
                }
            }
        }
        plugin_1.tools.Log(user.nickname, '刷粉丝榜', '已完成');
    }
}
exports.default = new SendGift();
