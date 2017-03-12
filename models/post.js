var mongodb = require('./db');

function Post(name, title, post) {
    this.name = name;
    this.title = title;
    this.post = post;
}

module.exports = Post;

Post.prototype.save = function(callback) {
    var date = new Date(),
        year = date.getFullYear(),
        month = year + '-' + (date.getMonth() + 1),
        day = month + '-' + date.getDate(),
        minute = day + ' ' + date.getHours() + ':' + (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
    var time = {
        date: date,
        year: year,
        month: month,
        day: day,
        minute: minute
    };

    var post = {
        name: this.name,
        time: time,
        title: this.title,
        post: this.post
    };

    mongodb.open(function(err, db) {
        if (err) {
            return callback(err);
        }

        db.collection('posts', function(err, collection) {
            if (err) {
                mongodb.close();
                return callback(err);
            }
            collection.insert(post, { safe: true }, function(err) {
                mongodb.close();
                if (err) {
                    return callback(err);
                }
                callback(null);
            });
        });
    });
};

Post.get = function(name, callback) {
    mongodb.open(function(err, db) {
        if (err) {
            return callback(err);
        }

        db.collection('posts', function(err, collection) {
            if (err) {
                mongodb.close();
                return callback(err);
            }

            var query = {};
            if(name){
            	query.name=name;
            }

            collection.find(query).sort({time:-1}).toArray(function(err,docs){
            	mongodb.close();
            	if(err){
            		return callback(err);
            	}
            	callback(null,docs);
            });
        });
    });
};
