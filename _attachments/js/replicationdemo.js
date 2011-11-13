console.log("page loading");

var names = ["adam", "jack", "jill", "sue", "bob", "richard",
             "john", "alison", "Jacob", "Isabella", "Ethan", "Sophia",
             "Michael", "Emma", "Jayden", "Olivia", "William", "Ava",
             "Alexander", "Emily", "Noah", "Abigail", "Daniel", "Madison",
             "Aiden", "Chloe", "Anthony", "Mia"];

var render = function(tpl, data) {
  return Mustache.to_html($("#" + tpl).html(), data);
};

var updateView = function(db) {
  $.couch.db(db).allDocs({include_docs:true, conflicts: true}).then(function(data) {
    var rows = $.grep(data.rows, function(obj) { return !/^_design/.test(obj.id); });
    var ndata = $.map(rows, function(val) { return val.doc; });
    var tpl = render("list_tpl", {rows:ndata});
    $("#" + db + "_view").html(tpl);
  });
};

// Ensure databases exist
$.ajax({type:'HEAD', url:'/minion'}).fail(function() {
  $.ajax({type:'PUT', url:'/minion'});
});

$.couch.db("minion").changes().onChange(function() {
 updateView("minion")
});

$.couch.db("replicationdemo").changes().onChange(function() {
 updateView("replicationdemo")
});

updateView("replicationdemo");
updateView("minion");

$(".entry_form").bind('submit', function(e) {

  e.preventDefault();
  e.stopPropagation();

  var $wrapper = $(e.target).parents(".wrapper");
  var db = $wrapper.attr("data-db");
  var obj = {
    _id: $wrapper.find("[name=id]").val(),
    color: $wrapper.find("[name=color]").val()
  };
  if ($wrapper.find("[name=rev]").val()) {
    obj._rev = $wrapper.find("[name=rev]").val();
  }

  if (obj._id === "") {
    obj._id = names[Math.floor(Math.random()*names.length)];
  }
  $.couch.db(db).saveDoc(obj);
});

$(".delete").bind('mousedown', function(e) {
  e.preventDefault();
  var $wrapper = $(e.target).parents(".wrapper");
  var db = $wrapper.attr("data-db");
  $.couch.db(db).drop().then(function() {
    $.ajax({type:'PUT', url:'/' + db}).then(function() {
      $.couch.db(db).changes().onChange(function() {
        updateView(db)
      });
    });
  });
});


$(".replicate").bind('mousedown', function(e) {
  e.preventDefault();
  var $wrapper = $(e.target).parents(".wrapper");
  var db = $wrapper.attr("data-db");
  $.couch.replicate(db, db === "replicationdemo"
                    ? "minion" : "replicationdemo", {}, {});
});


$(".clear").bind('click', function(e) {

  e.preventDefault();
  e.stopPropagation();

  var $wrapper = $(e.target).parents(".wrapper");
  var db = $.couch.db($wrapper.attr("data-db"));
  var docs = [];

  db.allDocs({}).then(function(data) {
    $.each(data.rows, function(_, obj) {
      if (!(/^_design/.test(obj.id))) {
        docs.push({
          _id: obj.id,
          _rev: obj.value.rev,
          _deleted: true
        });
      }
    });
    $.ajax({
      type:'POST',
      url: "/" + $wrapper.attr("data-db") + "/_bulk_docs",
      contentType: 'application/json',
      data: JSON.stringify({docs:docs})
    });
  });
});


$("#minion_conflicts .square_view li, #replicationdemo_conflicts .square_view li")
  .live('click', function(e) {

    var $wrapper = $(e.target).parents(".wrapper");
    var dbname = $wrapper.attr("data-db");
    var db = $.couch.db(dbname);
    var rev = $(this).attr("data-rev");
    var id = $(this).attr("data-id");

    db.removeDoc({_id: id, _rev: rev}).then(function() {
      $("#" + dbname + "_conflicts").html("");
    });
  });


$("#minion_view .square_view li, #replicationdemo_view .square_view li")
     .live('click', function(e) {

  var $wrapper = $(e.target).parents(".wrapper");
  var dbname = $wrapper.attr("data-db");
  var db = $.couch.db($wrapper.attr("data-db"));
  var id = $(this).attr("data-id");
  $wrapper.find("[name=id]").val(id);
  $wrapper.find("[name=color]").val($(this).attr("data-color"));
  $wrapper.find("[name=rev]").val($(this).attr("data-rev"));

  $("#" + dbname + "_conflicts").html("");

  var openRev = function(rev) {
    return db.openDoc(id, {rev: rev});
  };

  if ($(this).attr("data-conflicts")) {
    db.openDoc(id, {conflicts:true}).then(function(data) {
      $.when.apply(this, $.map(data._conflicts, openRev)).then(function() {
        if (data._conflicts.length === 1) {
          arguments = [arguments];
        }
        var conflicts = $.map(arguments, function(obj) {
          return obj[0];
        });
        conflicts.push(data);
        var tpl = render("list_tpl", {rows:conflicts});
        $("#" + dbname + "_conflicts").html(tpl);
      });
    });
  }


});

