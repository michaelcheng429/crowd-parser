var allLayersAnalysis = require('./sentiment/allLayersAnalysis');
var db = require('./database/database');

var emojiConverter = require('./sentiment/emoticonLayer/emojiConverter');

module.exports = function(io, T) {

  try {
    var TCH = require('./config/twitter_CH_private');
  } catch (e) {
    console.log(e);
    var TCH = T;
  }

  var clientIDGenerator = 0;

  var setSocketOnDatabase = function(){
    if(!db){
      setTimeout(setSocketOnDatabase.bind(exports), 150);
      return;
    }
    db.io = io;
  };

  setSocketOnDatabase();


  io.on('connection', function(socket) {

    // for tracking "rooms" different clients are in
    socket.on('getID', function(idFromClient) {
      var clientID = idFromClient || clientIDGenerator;
      console.log('joining client room ', clientID);
      socket.join(clientID);
      socket.emit('clientID', clientID);
      clientIDGenerator++;
    });

    socket.on('unsubscribe', function(room) {
        console.log('leaving client room', room);
        socket.leave(room);
    });

    // for testing connection to clients
    socket.on('send', function(data) {
        console.log('sending message' + data.message);
        io.sockets.in(data.room).emit('message', data);
    });

    // Gets top 10 trending topics.
    // This is requested on main.html page load and used for the sentiment display section
    socket.on('twitter rest trending', function() {

      T.get('trends/place', {id: 23424977}, function(err, data) {

        socket.emit('twitter rest trending', data);
      });
    });

    //this adds the io object to the datbase module so it can fire tweet emits on completion.
    //db.io = io;




    // Gets tweets for a search query
    // This is used for the sentiment display section
    socket.on('twitter rest search', function(query, result_type, count, max_id, clientID) {

      var params = {
        q: query,
        // Up to 100
        count: count,
        // "recent", "mixed", or "popular"
        result_type: result_type
      };

      if (max_id) {
        params.max_id = max_id;
      }

      T.get('search/tweets', params, function(err, data) {
        if (err) {
          console.log(err);
          io.emit('all layers', err);
        } else {

          // Add layer analyses to each tweet
          var allLayersResults = allLayersAnalysis.tweetsArray(data.statuses);

          //io.emit('all layers', allLayersResults);
          console.log('sending REST results to id ' + clientID);
          io.sockets.in(clientID).emit('all layers', allLayersResults);
        }

      });
    });

    // need var outside so I can find it and stop it later
    var continuousStream;
    // start continuous stream to client
    socket.on('twitter stream filter continuous', function(keywords) {
      console.log(keywords);

      if (keywords) {
        continuousStream = TCH.stream('statuses/filter', {track: keywords, language: 'en'});

        continuousStream.on('tweet', function(tweet) {
          var tweetResults = allLayersAnalysis.tweetsArray([tweet]).tweetsWithAnalyses[0];
          io.emit('tweet results', tweetResults);
        });
      }

    });

    // stop continuous stream on request from client
    socket.on('twitter stop continuous stream', function() {
      if (continuousStream) {
        continuousStream.stop();
      }
    });


    // ===== THIS PULLS TWEETS BY KEYWORDS TO THE DATABASe ======= //


    socket.on('tweet keyword', function(keyword, clientID){


      if(keyword === undefined || clientID === undefined){
        console.log("ERR: server requires both a keyword and a clientID to be sent on socket");
        return;
      }

       db.sendTweetPackagesForKeywordToClient(keyword, clientID, function(err, result){}, function(){});
      //callback will either return error, or the name of the keyword if it exists

    });

    //TODO add a cancel request, and only allow one keyword request per client



    // ===== THIS IS USED TO DOWNLOAD TWEETS TO THE DATABASE ====== //

    io.streamDownload;
    io.listenToTweetStream = true;



    io.startTweetDownload = function(_io, rate ){
      io = io || _io;
        if(io.streamDownload){
          io.streamDownload.stop();
        }

        console.log('START DOWNLOAD');
        io.listenToTweetStream = true;
        io.streamDownload = T.stream('statuses/sample');
        var count = 0;
        var rate = rate || 1;


        io.streamDownload.on('tweet', function(tweet) {
          if(io.listenToTweetStream === false){
            return;
          }

          if (tweet.lang === 'en') {
            count++;
            if(count > 10000000) count = 2;
            if (count === 1 || count % rate === 0) {
              if(!db || !db.isLive){
                console.log("WAITING FOR DB");
                return;
              }
              db.executeFullChainForIncomingTweets(tweet, function(err, message, fields) {
                if (err) {
                  console.log(err);
                  return;
                } else {

                }
              });
            }
          }
        });

    };

    var boundStart = io.startTweetDownload.bind(this, io);

    socket.on('start download', function(rate){
      boundStart(rate);
    });

    io.stopTweetDownload = function(_io){
      io = io || _io;
      io.listenToTweetStream = false;
      if(io.streamDownload){
        io.streamDownload.stop();
      }
      console.log('STOP *******************');
      console.log('******************* TWEETS STILL PROCESSING THOUGH');
    };

    var boundStop = io.stopTweetDownload.bind(this, io);

    socket.on('stop download', function(){
      boundStop();
    });

  });

};

// var tweet = 'If this doesn\'t make you smile, I don\'t know what will: http://youtu.be/RoQwFxEkW2E  👶😂';

// console.log(emojiConverter.convertEmojisInTweet('u\'ve been our inspiration for the past 19 years! Wishing you a wonderful day! 😃😘🎁🎉🎈🎂🍸'));

// var convertedTweet = 'If this doesn\'t make you smile, I don\'t know what will: http://youtu.be/RoQwFxEkW2E  <%-1f476%><%-1f602%>';

// console.log(emojiConverter.restoreEmojisInTweet('u\'ve been our inspiration for the past 19 years! Wishing you a wonderful day! <%-1f603%><%-1f618%><%-1f381%><%-1f389%><%-1f388%><%-1f382%><%-1f378%>'));

// streamDownload.on('tweet', function(tweet) {

//   if (tweet.lang === 'en') {
//     count++;
//     if(count > 10000000) count = 2;
//     if (count === 1 || count % rate === 0) {
//       if(!db || !db.isLive){
//         console.log("WAITING FOR DB");
//         return;
//     }

//     tweet.text = emojiConverter.convertEmojisInTweet(tweet.text);
//       db.genericAddToTable('tweets', [tweet], function(err, container, fields) {
//         if (err) {
//           console.log(err);
//           return;
//         } else {
//           // console.log("EMIT tweet");
//           // exports.io.emit('tweet added', container);
//           console.log('TWEET ADDED', tweet.text);
//         }
//       });
//     }
//   }
// });
