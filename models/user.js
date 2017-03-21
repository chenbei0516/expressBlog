var crypto = require('crypto');
var mongodb = require('./db')();
var async = require('async');

function User(user) {
    this.name = user.name;
    this.password = user.password;
    this.email = user.email;
}

module.exports = User;

// 存储用户信息

User.prototype.save = function(callback) {
    // 要存入数据库的用户文档
    var md5 = crypto.createHash('md5'),
        email_MD5 = md5.update(this.email.toLowerCase()).digest('hex'),
        head = "http://www.gravatar.com/avatar/" + email_MD5 + "?s=48";
    var user = {
        name: this.name,
        password: this.password,
        email: this.email,
        head: head
    };

    async.waterfall([
            // 打开数据库
            function(cb) {
                mongodb.open(function(err, db) {
                    cb(err, db);
                });
            },
            // 读取users集合
            function(db, cb) {
                db.collection('users', function(err, collection) {
                    cb(err, collection);
                });
            }
        ],
        // 插入用户数据
        function(collection, cb) {
            collection.insert(user, {
                safe: true
            }, function(err, user) {
                cb(err, user);
            });
        },
        function(err, user) {
            mongodb.close();
            callback(err, user[0]);
        });
};

// 读取用户信息

User.get = function(name, callback) {

    async.waterfall([
        function(cb) {
            mongodb.open(function(err, db) {
                cb(err, db);
            });
        },
        function(db, cb) {
            db.collection('users', function(err, collection) {
                cb(err, collection);
            });
        },
        function(collection, cb) {
            collection.findOne({
                "name": name
            }, function(err, user) {
                cb(err, user);
            });
        }
    ], function(err, user) {
        mongodb.close();
        callback(err, user);
    });
};
