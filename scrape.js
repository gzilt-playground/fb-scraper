// Generated by CoffeeScript 1.9.1
(function() {
  var _env, casper, cheerio, currentPage, filePath, fs, hasClickedAllStories, parseFacebookPost, skipScraping, user;

  _env = require("system").env;

  fs = require("fs");

  casper = require("casper").create({
    logLevel: "debug",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.22 (KHTML, like Gecko) Chrome/25.0.1364.172 Safari/537.22",
    pageSettings: {
      loadImages: false,
      loadPlugins: false
    }
  });

  cheerio = require("cheerio");

  if (!(_env.hasOwnProperty("fb_user") && _env.hasOwnProperty("fb_pass"))) {
    casper.echo("Missing environment variables. Do `source .env` first.");
    casper.exit();
  }

  user = casper.cli.has(0) ? casper.cli.get(0) : "zuck";

  filePath = "parsed/" + user + ".json";

  skipScraping = casper.cli.has("parse-only");


  /**
   * This transforms elements of a single post into a JSON object
   * @param  {object} item    The current status item
   * @return {object}
   */

  parseFacebookPost = function(item) {

    /**
     * Count number of shares on a post
     * @param  {Cheerio} el The full status element
     * @return {int}    Number of shares
     */
    var $, countComments, countLikes, countShares;
    countShares = function(el) {
      if (el('.UFIShareLink').length === 0) {
        return 0;
      }
      return parseInt(el('.UFIShareLink').first().text().match(/[0-9]+/), 10);
    };

    /**
     * Count number of likes on a post
     * @param  {Cheerio} el The full status element
     * @return {int}    Number of likes
     */
    countLikes = function(el) {
      if (el('._1g5v').length === 0) {
        return 0;
      }
      return parseInt(el('._1g5v').text().match(/[0-9]+/), 10);
    };

    /**
     * Count number of comments on a post
     * NOTE: at the moment this doesn't count comment replies on purpose
     * if you do want to count them... exercise left to the reader!
     *
     * @param  {Cheerio} el The full status element
     * @return {int}    Number of comments
     */
    countComments = function(el) {
      var total;
      total = 0;
      total += el('span.UFICommentBody').length;
      if (el('.UFIPagerRow').length !== 0) {
        total += parseInt(el('.UFIPagerRow').first().text().match(/[0-9]+/), 10);
      }
      return total;
    };
    if (!item.html) {
      return null;
    }
    $ = cheerio.load(item.html);
    if ($('.userContent').first().text() === "" || $('.mtm').length > 0) {
      return null;
    }
    return {
      content: $('.userContent').first().text(),
      permalink: $('abbr').first().parents('a').attr('href'),
      time: $('abbr').first().text(),
      timestamp: $('abbr').first().data('utime'),
      likes: countLikes($),
      shares: countShares($),
      comments: countComments($),
      isFriendPost: $('.mhs').length > 0
    };
  };

  casper.start("https://www.facebook.com", function() {
    var pageTitle, query;
    if (skipScraping) {
      return;
    }
    pageTitle = this.getTitle();
    if (pageTitle === "Facebook - Log In or Sign Up") {
      casper.echo("Attempting to log in...");
      query = {
        email: _env.fb_user,
        pass: _env.fb_pass
      };
      return this.fill("#login_form", query, true);
    } else if (pageTitle === "Facebook") {
      return casper.echo("Already logged in");
    } else {
      casper.echo("Oops, something unexpected happened. Page title: " + pageTitle);
      return casper.exit();
    }
  });

  casper.thenOpen("https://www.facebook.com/" + user);

  currentPage = 1;

  hasClickedAllStories = false;

  casper.then(function() {
    var tryAndScroll;
    if (skipScraping) {
      return;
    }
    casper.echo("Now on https://www.facebook.com/" + user);
    casper.echo(this.getTitle());
    tryAndScroll = function() {
      return casper.waitFor(function() {
        casper.scrollToBottom();
        return true;
      }, function() {
        if (!hasClickedAllStories) {
          if (casper.visible('#u_jsonp_6_4')) {
            casper.click('#u_jsonp_6_4');
            casper.echo('[clicked Visible Highlights]');
            hasClickedAllStories = true;
          }
        }
        if (!(currentPage > 150 || casper.visible({
          type: "xpath",
          path: "//a[@class and starts-with(.,'Born')]"
        }))) {
          casper.echo("Loaded page " + (currentPage++));
          return tryAndScroll();
        }
      });
    };
    return tryAndScroll();
  });

  casper.then(function() {
    var elements, item, key, p, parsedPosts;
    casper.echo("Reached end of profile, parsing and saving to " + filePath);
    if (!skipScraping) {
      elements = this.getElementsInfo('.userContentWrapper');
      fs.write(filePath + ".raw", JSON.stringify(elements));
    } else {
      elements = JSON.parse(fs.read(filePath + ".raw"));
    }
    parsedPosts = [];
    for (key in elements) {
      item = elements[key];
      if ((p = parseFacebookPost(item)) !== null) {
        parsedPosts.push(p);
      }
    }
    fs.write(filePath, JSON.stringify(parsedPosts), "w");
    return casper.echo("Done!");
  });

  casper.run();

}).call(this);
