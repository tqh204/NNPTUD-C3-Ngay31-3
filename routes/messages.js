let express = require('express')
let router = express.Router()
let messageModel = require('../schemas/messages')
let { CheckLogin } = require('../utils/authHandler')
let { uploadImage } = require('../utils/uploadHandler')
let mongoose = require('mongoose')

// GET /:userID - Lấy toàn bộ tin nhắn giữa user hiện tại và userID
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserID = req.user._id;
        let otherUserID = req.params.userID;

        // Kiểm tra userID hợp lệ
        if (!mongoose.Types.ObjectId.isValid(otherUserID)) {
            return res.status(400).send({ message: "userID không hợp lệ" });
        }

        let messages = await messageModel.find({
            $or: [
                { from: currentUserID, to: otherUserID },
                { from: otherUserID, to: currentUserID }
            ]
        })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: 1 });

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST / - Gửi tin nhắn (text hoặc file)
router.post('/', CheckLogin, uploadImage.single('file'), async function (req, res, next) {
    try {
        let currentUserID = req.user._id;
        let { to, text } = req.body;

        // Kiểm tra to hợp lệ
        if (!to || !mongoose.Types.ObjectId.isValid(to)) {
            return res.status(400).send({ message: "to (userID) không hợp lệ" });
        }

        let messageContent;

        if (req.file) {
            // Có file đính kèm -> type là "file", text là path dẫn đến file
            messageContent = {
                type: "file",
                text: req.file.path
            };
        } else if (text) {
            // Chỉ text -> type là "text", text là nội dung
            messageContent = {
                type: "text",
                text: text
            };
        } else {
            return res.status(400).send({ message: "Cần có nội dung text hoặc file" });
        }

        let newMessage = new messageModel({
            from: currentUserID,
            to: to,
            messageContent: messageContent
        });

        newMessage = await newMessage.save();
        newMessage = await newMessage.populate('from', 'username fullName avatarUrl');
        newMessage = await newMessage.populate('to', 'username fullName avatarUrl');

        res.send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET / - Lấy tin nhắn cuối cùng của mỗi người dùng mà user hiện tại đã nhắn tin
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserID = req.user._id;

        // Lấy tất cả tin nhắn liên quan đến user hiện tại
        let messages = await messageModel.find({
            $or: [
                { from: currentUserID },
                { to: currentUserID }
            ]
        })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: -1 });

        // Lấy tin nhắn cuối cùng của mỗi người dùng khác
        let seen = new Set();
        let lastMessages = [];

        for (let msg of messages) {
            // Xác định ID của người dùng kia trong cuộc hội thoại
            let otherUser = msg.from._id.toString() === currentUserID.toString()
                ? msg.to._id.toString()
                : msg.from._id.toString();

            if (!seen.has(otherUser)) {
                seen.add(otherUser);
                lastMessages.push(msg);
            }
        }

        res.send(lastMessages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
