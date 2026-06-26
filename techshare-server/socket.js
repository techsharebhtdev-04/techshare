const { Server } = require("socket.io");

let io;

function initSocket(server) {
  io = new Server(server, {
  cors: {
    origin:
      "http://localhost:3000",
  }
  });

  io.on("connection", (socket) => {

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
    });

    socket.on("send-message", (data) => {
      const { roomId, message } = data;
      io.to(roomId).emit("receive-message", message);
      
      socket.to(roomId).emit("notification", {
        type: "new_message",
        title: "Tin nhắn mới",
        message: `${message.senderName} vừa gửi tin nhắn`,
        requestId: roomId,
      });
    });

    socket.on("typing", (data) => {
      const { roomId, isTyping, userName } = data;
      socket.to(roomId).emit("user-typing", { isTyping, userName });
    });

    socket.on("disconnect", () => {
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

function sendNotification(userId, notification) {
  if (io) {
    io.to(`user_${userId}`).emit("notification", notification);
  }
}

function notifyNewArticle(article) {
  if (io) {
    io.emit("notification", {
      type: "new_article",
      title: "Bài viết mới",
      message: `${article.author} vừa đăng bài: "${article.title}"`,
      articleId: article._id,
    });
  }
}

function notifyArticleReported(authorId, article, reportCount) {
  if (io) {
    sendNotification(authorId, {
      type: "article_reported",
      title: "Bài viết của bạn bị báo cáo",
      message: `Bài viết "${article.title}" đã nhận ${reportCount}/3 báo cáo. Vui lòng kiểm tra và chỉnh sửa.`,
      articleId: article._id,
    });
  }
}

function notifyNewReview(volunteerId, review) {
  if (io) {
    sendNotification(volunteerId, {
      type: "new_review",
      title: "⭐ Đánh giá mới",
      message: `${review.userName} vừa đánh giá bạn ${review.rating}⭐: "${review.comment.substring(0, 50)}..."`,
      reviewId: review._id,
    });
  }
}

function notifyRequestConfirmed(request) {
  if (io && request.volunteerId) {
    sendNotification(request.volunteerId._id || request.volunteerId, {
      type: "request_confirmed",
      title: "Yêu cầu đã được xác nhận",
      message: `${request.fullName} đã xác nhận hoàn thành yêu cầu hỗ trợ. Cảm ơn bạn!`,
      requestId: request._id,
    });
  }
}

module.exports = { 
  initSocket, 
  getIO, 
  sendNotification,
  notifyNewArticle,
  notifyArticleReported,
  notifyNewReview,
  notifyRequestConfirmed,
};
