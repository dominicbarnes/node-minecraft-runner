var events = require("events"),
    fs     = require("fs"),
    https  = require("https"),
    path   = require("path"),
    should = require("should"),
    Game   = require("../lib/Game");

describe("Game", function () {
    var dir  = path.join(__dirname, "support/server"),
        jar  = path.join(__dirname, "support/minecraft_server.jar"),
        url  = "https://s3.amazonaws.com/MinecraftDownload/launcher/minecraft_server.jar",
        game = new Game(dir, jar);

    before(function (done) {
        var context = this;

        fs.exists(jar, function (exists) {
            if (exists) return done();

            context.timeout(5000);
            https.get(url, function (res) {
                res.pipe(fs.createWriteStream(jar));
                res.on("end", done);
            });
        });
    });

    describe("constructor", function () {
        it("should be an instance of EventEmitter", function () {
            game.should.be.instanceof(events.EventEmitter);
        });
    });

    describe(".parseLog()", function () {
        it("should return a hash of details about the log", function () {
            Game.parseLog("2012-09-29 23:56:07 [INFO] Test Log Entry")
                .should.eql({
                    datetime: "2012-09-29 23:56:07",
                    level:    "INFO",
                    text:     "Test Log Entry"
                });
        });
    });

    describe(".emitLog()", function () {
        afterEach(function () {
            game.removeAllListeners();
        });

        it("should emit 'version' and set the version property", function () {
            var version = "1.4.7";

            game.once("version", function (ver) {
                ver.should.equal(version);
            });

            Game.emitLog(game, "2013-01-20 12:46:56 [INFO] Starting minecraft server version " + version);

            game.version.should.equal(version);
        });

        it("should emit 'log'", function (done) {
            game.once("log", function (meta) {
                should.exist(meta);
                done();
            });

            Game.emitLog(game, "2012-09-29 23:56:07 [INFO] Test Log Entry");
        });

        it("should emit 'error'", function (done) {
            game.once("error", function (meta) {
                should.exist(meta);
                done();
            });

            Game.emitLog(game, "2012-09-30 12:01:00 [ERROR] Something really bad happened");
        });

        it("should emit 'joined'", function (done) {
            game.once("joined", function (player, meta) {
                player.should.equal("testuser");

                meta.should.eql({
                    source: "/192.168.1.136:50884",
                    entity: 94,
                    location: {
                        x: -7.9431711874409,
                        y: 39.0,
                        z: 834.0122034190467
                    }
                });

                game.players.should.have.length(1);

                done();
            });

            Game.emitLog(game, "2012-09-29 14:29:23 [INFO] testuser[/192.168.1.136:50884] logged in with entity id 94 at (-7.9431711874409, 39.0, 834.0122034190467)");
        });

        it("should emit 'left'", function (done) {
            game.once("left", function (user, reason) {
                user.should.equal("testuser");
                reason.should.equal("disconnect.quitting");
                done();
            });

            Game.emitLog(game, "2012-09-29 15:32:20 [INFO] testuser lost connection: disconnect.quitting");
        });

        it("should emit 'started'", function (done) {
            game.once("started", done);
            Game.emitLog(game, '2012-09-29 14:29:20 [INFO] Done (3.256s)! For help, type "help" or "?"');
        });

        it("should emit 'saveoff'", function (done) {
            game.once("saveoff", done);
            Game.emitLog(game, "2012-09-29 15:32:20 [INFO] Turned off world auto-saving");
        });

        it("should emit 'saved'", function (done) {
            game.once("saved", done);
            Game.emitLog(game, "2012-09-29 15:32:20 [INFO] Saved the world");
        });

        it("should emit 'saveon'", function (done) {
            game.once("saveon", done);
            Game.emitLog(game, "2012-09-29 15:32:20 [INFO] Turned on world auto-saving");
        });
    });

    describe("#start()", function () {
        this.timeout(10000);

        afterEach(function (done) {
            game.stop(function () {
                done();
            });
        });

        it("should spawn a new process", function (done) {
            game.start(function (err, proc) {
                if (err) return done(err);

                proc.should.equal(game.process);
                done();
            });

            should.exist(game.process);
        });

        it("should change the status property", function (done) {
            game.status.should.equal("Stopped");

            game.start(function (err) {
                if (err) return done(err);

                game.status.should.equal("Running");
                done();
            });

            game.status.should.equal("Starting");
        });
    });

    describe("#stop()", function () {
        this.timeout(2500);

        beforeEach(function (done) {
            this.timeout(10000);

            game.start(done);
        });

        it("should change the status property", function (done) {
            game.status.should.equal("Running");

            game.stop(function (err) {
                if (err) return done(err);
                game.status.should.equal("Stopped");
                done();
            });

            game.status.should.equal("Stopping");
        });

        it("should null the process property", function (done) {
            should.exist(game.process);

            game.stop(function (err) {
                if (err) return done(err);
                should.not.exist(game.process);
                done();
            });
        });
    });

    describe("#restart()", function () {
        this.timeout(10000);

        beforeEach(function (done) {
            game.start(done);
        });

        afterEach(function (done) {
            game.stop(done);
        });

        it("should emit version, stop, stopped, start, and started events", function (done) {
            var events = 0;
            function incr() { events += 1; }

            game.on("version", incr);
            game.on("stop",    incr);
            game.on("stopped", incr);
            game.on("start",   incr);
            game.on("started", incr);

            game.restart(function (err) {
                if (err) return done(err);
                events.should.equal(5);
                done();
            });
        });
    });
});
