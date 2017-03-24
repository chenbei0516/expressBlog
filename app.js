var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

var session = require('express-session');
var flash = require('connect-flash');
var MongoStore = require('connect-mongo')(session);
var multer = require('multer');
var fs = require('fs');
var accessLog = fs.createWriteStream('access.log', { flasgs: 'a' });
var errorLog = fs.createWriteStream('error.log', { flasgs: 'a' });
var settings = require('./settings');
var index = require('./routes/index');
// var users = require('./routes/users');
// var routes = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');
app.engine('hbs', exphbs({
    layoutsDir: 'views',
    defaultLayout: 'layout',
    extname: '.hbs'
}));
app.set('view engine', 'hbs');



// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev', { stream: accessLog }));
// app.use(logger({ stream: accessLog }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
// app.use('/users', users);

passport.use(new GitHubStrategy({
    clientID: "0477cb75252813e4e132",
    clientSecret: "a8a217a1115137cf6cf38898a78677af86bb263b",
    callbackURL: "/login/github/callback"
}, function(accessToken, refreshToken, profile, done) {
    done(null, profile);
}));

app.use(function(err, req, res, next) {
    var meta = '[' + new Date() + ']' + req.url + '\n';
    errorLog.write(meta + err.stack + '\n');
    next();
});

app.use(flash());
app.use(session({
    secret: settings.cookieSecret,
    key: settings.db,
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
    store: new MongoStore({
        db: settings.db,
        host: settings.host,
        port: settings.port,
        url: settings.mongodb
    })
}));



var storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './public/images');
    },
    filename: function(req, file, callback) {
        callback(null, file.originalname);
    }
});

var upload = multer({
    storage: storage
});
var cpUpload = upload.any();
app.use(cpUpload);


app.use('/', index);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
