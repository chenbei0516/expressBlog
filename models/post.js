// var markdown = require('markdown').markdown;
var ObjectID = require('mongodb').ObjectID;
var Db = require('./db');
var poolModule = require('generic-pool');

/*var factory = {
    create: function() {
        return new Promise(function(resolve, reject) {
            var mongodb = Db();
            mongodb.open(function(err, db) {
                resolve(db);
                reject(err);
            });
        });
    },
    destroy: function(mongodb) {
        return new Promise(function(resolve, reject) {
            mongodb.close();
            resolve();
            reject();
        });
    }
};

var opts = {
    max: 100,
    min: 5,
    idleTimeoutMillis: 30000,
    log: true
};

var pool = poolModule.createPool(factory, opts);*/

var pool = poolModule.Pool({
    name: 'mongoPool',
    create: function(callback) {
        var mongodb = Db();
        mongodb.open(function(err, db) {
            callback(err, db);
        });
    },
    destroy: function(mongodb) {
        mongodb.close();
    },
    max: 100,
    min: 5,
    idleTimeoutMillis: 30000,
    log: false
});

function Post(name, head, title, tags, post) {
    this.name = name;
    this.head = head;
    this.title = title;
    this.tags = tags;
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
        head: this.head,
        time: time,
        title: this.title,
        tags: this.tags,
        post: this.post,
        comments: [],
        reprint_info: {},
        pv: 0
    };

    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }

        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.insert(post, { safe: true }, function(err) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null);
            });
        });
    });
};


// 将Post.getAll 改为Post.getTen 每次获取十篇文章
Post.getTen = function(name, page, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }

        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }

            var query = {};
            if (name) {
                query.name = name;
            }

            /////////////////////////////////////////////////////////////////////////////
            // collection.find(query).sort({ time: -1 }).toArray(function(err, docs) { //
            /////////////////////////////////////////////////////////////////////////////

            collection.count(query, function(err, total) {
                collection.find(query, {
                    skip: (page - 1) * 10,
                    limit: 10
                }).sort({ time: -1 }).toArray(function(err, docs) {
                    pool.release(mongodb);
                    if (err) {
                        return callback(err);
                    }

                    // docs.forEach(function(doc) {
                    //     doc.post = markdown.toHTML(doc.post);
                    // });
                    callback(null, docs, total);
                });
            });
        });
    });
};


Post.getOne = function(_id, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.findOne({
                "_id": new ObjectID(_id)
            }, function(err, doc) {
                if (err) {
                    pool.release(mongodb);
                    return callback(err);
                }
                if (doc) {
                    collection.update({
                        "_id": new ObjectID(_id)
                    }, {
                        $inc: { "pv": 1 }
                    }, function(err) {
                        pool.release(mongodb);
                        if (err) {
                            return callback(err);
                        }
                    });

                    // doc.post = markdown.toHTML(doc.post);
                    // if (!doc.comments) {
                    //     doc.comments = [];
                    //     doc.comments.forEach(function(comment) {
                    //         comment.content = markdown.toHTML(comment.content);
                    //     });
                    // }
                    callback(null, doc);
                }
            });
        });
    });
};

Post.edit = function(name, day, title, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.findOne({
                "name": name,
                "time.day": day,
                "title": title
            }, function(err, doc) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null, doc);
            });

        });
    });
};

Post.update = function(name, day, title, post, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }

            collection.update({
                "name": name,
                "time.day": day,
                "title": title
            }, { $set: { post: post } }, function(err) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null);
            });
        });
    });
};

Post.remove = function(name, day, title, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }

            collection.findOne({
                "name": name,
                "time.day": day,
                "title": title
            }, function(err, doc) {
                if (err) {
                    pool.release(mongodb);
                    return callback(err);
                }
                var reprint_from = "";
                if (doc.reprint_info.reprint_from) {
                    reprint_from = doc.reprint_info.reprint_from;
                }
                if (reprint_from !== "") {
                    collection.update({
                        "name": reprint_from.name,
                        "time.day": reprint_from.day,
                        "title": reprint_from.title
                    }, {
                        $pull: {
                            "reprint_info.reprint_to": {
                                "name": name,
                                "day": day,
                                "title": title
                            }
                        }
                    }, function(err) {
                        if (err) {
                            pool.release(mongodb);
                            return callback(err);
                        }
                    });
                }
                collection.remove({
                    "name": name,
                    "time.day": day,
                    "title": title
                }, { w: 1 }, function(err) {
                    pool.release(mongodb);
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            });
        });
    });
};

Post.getArchive = function(callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.find({}, {
                "name": 1,
                "time": 1,
                "title": 1,
            }).sort({ time: -1 }).toArray(function(err, docs) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};

Post.getTags = function(callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.distinct('tags', function(err, docs) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};

Post.getTag = function(tag, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.find({
                "tags": tag
            }, {
                "name": 1,
                "time": 1,
                "title": 1
            }).sort({ time: -1 }).toArray(function(err, docs) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};


Post.search = function(keyword, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            var pattern = new RegExp(keyword, 'i');
            collection.find({
                "title": pattern
            }, {
                "name": 1,
                "time": 1,
                "title": 1
            }).sort({
                time: -1
            }).toArray(function(err, docs) {
                pool.release(mongodb);
                if (err) {
                    return callback(err);
                }
                callback(null, docs);
            });
        });
    });
};


Post.reprint = function(reprint_from, reprint_to, callback) {
    pool.acquire(function(err, mongodb) {
        if (err) {
            return callback(err);
        }
        mongodb.collection('posts', function(err, collection) {
            if (err) {
                pool.release(mongodb);
                return callback(err);
            }
            collection.findOne({
                "name": reprint_from.name,
                "time.day": reprint_from.day,
                "title": reprint_from.title
            }, function(err, doc) {
                if (err) {
                    pool.release(mongodb);
                    return callback(err);
                }

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

                delete doc._id;
                doc.name = reprint_to.name;
                doc.head = reprint_to.head;
                doc.time = time;
                doc.title = (doc.title.search(/[转载]/) > -1) ? doc.title : "[转载]" + doc.title;
                doc.comments = [];
                doc.reprint_info = { "reprint_from": reprint_from };
                doc.pv = 0;

                collection.update({
                    "name": reprint_from.name,
                    "time.day": reprint_from.day,
                    "title": reprint_from.title
                }, {
                    $push: {
                        "reprint_info.reprint_to": {
                            "name": doc.name,
                            "day": time.day,
                            "title": doc.title
                        }
                    }
                }, function(err) {
                    if (err) {
                        pool.release(mongodb);
                        return callback(err);
                    }
                });

                collection.insert(doc, {
                    safe: true
                }, function(err, post) {
                    pool.release(mongodb);
                    if (err) {
                        return callback(err);
                    }
                    callback(err, post[0]);
                });
            });
        });
    });
};
