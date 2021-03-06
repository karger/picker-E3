/*
    Responsible for loading all static saved data at startup
*/

var classes_by_time = {};

function loadSavedData() {
    window.exhibit = Exhibit.create();
    window.exhibit.configureFromDOM();

    loadStaticData("data/user.php", window.database, setupLogin);
    processClassesByTime();
}

/*
Loads the data from saved classes in a user account
*/
function loadStaticData(link, database, cont) {
    var url = typeof link == "string" ? link : link.href;
    // Given a relative or absolute URL, returns the absolute URL
    url = Exhibit.Persistence.resolveURL(url);
    var fError = function(jqXHR, textStatus, errorThrown) {
        Exhibit.UI.hideBusyIndicator();
        Exhibit.UI.showHelp(Exhibit._("%general.failedToLoadDataFileMessage", link));
        if (cont) cont();
    };

    var fSuccess = function(jsonObject, textStatus, jqXHR) {
        Exhibit.UI.hideBusyIndicator();
        try {
            if (jsonObject != null) {
                if (jsonObject.items && jsonObject.items[0] && jsonObject.items[0].type == "Class") {
                    jsonObject = processOfficialData(jsonObject);
                } else if (jsonObject.items && jsonObject.items[0] && jsonObject.items[0].type == "UserError") {
		            $('.error-popup-link').magnificPopup({
			        items: {
                        src: '<div class="login-error"><b style="font-size: 18px; display: block; text-align:center; margin: 10px;"> Cannot login in. Please download an MIT certificate from: <a href="https://ist.mit.edu/certificates">MIT IS&T</a>. Only members of the MIT community may view logged in contents.</b></div>',
                        type: 'inline'
                        }
		            });

		            $('.error-popup-link').click();
                }
                database.loadData(jsonObject, Exhibit.Persistence.getBaseURL(url), cont);
            }
        } catch (error) {
            Exhibit.Debug.exception(error, "Error loading Exhibit JSON data from " + url);
        } finally {
            if (cont) cont();
        }
    };

    Exhibit.UI.showBusyIndicator();
    // Calls fSuccess if data is json in correct form, else calls fError
    $.ajax({ url : url,
        error : fError,
        success: fSuccess,
        dataType: 'json' });
}

/*
Processes the json into correct format for picker
*/
function processOfficialData(json) {
    var items = json.items;
    // If individualClasses exists, we are here loading only the one class
    // that is the "master class" of a cross-listed class
    var crossListedClasses = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        // If true this is a cross-listed class, and this is not the "master" class
        // Ex. if this class is 18.062, rename it 6.042 and load 6.042
        if ('master_subject_id' in item && item.id != item.master_subject_id) {
            var course = item.master_subject_id.split('.')[0];
            if (!isLoaded(course)) {
                crossListedClasses.push(item.master_subject_id);
            }
        // Once both 18.062 and 6.042 are loaded, they will be merged as one class with two courses ["6", "18"]
            items[i] = {"id":item.master_subject_id, "course":item.course, "label":item.label, "type":item.type};
        }
        // Otherwise, this is a regular class -- just load it
        else {
            processOfficialDataItem(item);
        }
    }
    if (crossListedClasses.length >0) {
        loadIndividualClasses(crossListedClasses);
    }
    return json;
}

/*
    Pass in listener for calendar cells
*/
function showClassesDuringTime(obj) {
    logData["looked at classes during time", $(obj[0]).attr("classid")];

    var classes = classes_by_time[$(obj[0]).attr("classid")];
    var backgroundc = $($(".timegrid-hline").find("[classid='" + $(obj[0]).attr("classid") + "']")).css("background-color");
    if ( backgroundc == "rgb(0, 0, 128)" || backgroundc == "#000080" ) {
	$("#timed-classes-list").empty();
	$("#right-time-wrapper-list").empty();
	$($(".timegrid-hline").find("[classid='" + $(obj[0]).attr("classid") + "']")).css("background-color", "#FFFFFF");
	return null;
    }

    $(".timegrid-vline").css("background-color", "#FFFFFF");
    $($(".timegrid-hline").find("[classid='" + $(obj[0]).attr("classid") + "']")).css("background-color", "#000080");

    if ($("#schedule-details-layer").css("visibility") != "visible") {
        $("#timed-classes-list").empty();
        $("#timed-classes-list").append("<h1>Showing classes occuring on " + parseDayAndTime($(obj[0]).attr("classid")) + ":</h1><br>");
        $("#timed-classes-list").append("<table></table>");
        var numClasses = classes.length;
        var classesPerColumn = Math.ceil(numClasses/3);
        var counter = 0;
        for (var i = 0; i < 3; i++) {
            $("#timed-classes-list table").append("<td width='35%'></td>");
            counter = 0;
            while (counter < classesPerColumn && (i * classesPerColumn + counter) < numClasses) {
                $($("#timed-classes-list table td")[i]).append("<a href='javascript:{}' onclick='showClickedClassDetails(" + "&quot;" + classes[i * classesPerColumn + counter] + "&quot;" + ");'>"+ classes[i * classesPerColumn + counter] + "</a><br>");
                counter++;
            }
        }
    } else {
	$("#right-time-wrapper-list").empty();
        $("#right-time-wrapper-list").append("<br><br><h1>Showing classes occuring on " + parseDayAndTime($(obj[0]).attr("classid")) + ":</h1>");
        for (i in classes) {
            if (window.database.getObject(classes[i], "label") != null)
                $("#right-time-wrapper-list").append("<br>" + processPrereqs(classes[i], true) + " " + window.database.getObject(classes[i], "label") + "<br>");
        }
    }
}

/*
Parses the day and time from calendar to words
*/
function parseDayAndTime(dayAndTime) {
    var elts = dayAndTime.split("");

    var days = {
        "M": "Monday",
        "T": "Tuesday",
        "W": "Wednesday",
        "R": "Thursday",
        "F": "Friday",
        "S": "Saturday/Sunday"
    }

    var times = {
        "8": "8 am",
        "9": "9 am",
        "10": "10 am",
        "11": "11 am",
        "12": "12 pm",
        "13": "1 pm",
        "14": "2 pm",
        "15": "3 pm",
        "16": "4 pm",
        "17": "5 pm",
        "18": "6 pm",
        "19": "7 pm",
        "20": "8 pm",
        "21": "9 pm"
    }

    return days[elts[0]] + ", " + times[dayAndTime.slice(1, dayAndTime.length)]
}


/**
 * Makes following changes to JSON
 * before loaded by Exhibit
 **/
function processOfficialDataItem(item) {
    if ('prereqs' in item) { item.prereqs = processPrereqs(item.prereqs); }

    if ('id' in item) {
        item['courseNumber'] = parseNumber(item.master_subject_id);
    }

    for (attribute in item) {
        if (item[attribute] == '') { delete item[attribute]; }
    }

    if ('hass_attribute' in item)  {
	var categories = item['hass_attribute'].split(",");
	var hasses = [];
	for (var i = 0; i < categories.length; i++) {
		if (categories[i] == "HA") {
			hasses.push("Hass-A");
		} else if (categories[i] == "HS") {
			hasses.push("Hass-S");
		} else if (categories[i] == "HH") {
			hasses.push("Hass-H");
		} else if (categories[i] == "HE") {
			hasses.push("Hass-E");
		}
	}
	item['hass_attribute'] = hasses;
    }

    if ('comm_req_attribute' in item || 'gir_attribute' in item) {
	var newReqs = [];
	if ('comm_req_attribute' in item ) {
		var reqs = item['comm_req_attribute'].split(",");
		for (var i = 0; i < reqs.length; i++) {
			if (reqs[i] == "CIH") {
				newReqs.push("CI-H");
			} else if (reqs[i] == "CIM") {
				newReqs.push("CI-M");
			} else if (reqs[i] == "CIHW") {
				newReqs.push("CI-HW");
			}
		}
	}

	if ('gir_attribute' in item) {
		reqs = item['gir_attribute'].split(",");
		for (var i = 0; i < reqs.length; i++) {
			if (reqs[i] == "BIOL") {
				newReqs.push("Biology");
			} else if (reqs[i] == "CAL1") {
				newReqs.push("Calculus-1");
			} else if (reqs[i] == "CAL2") {
				newReqs.push("Calculus-2");
			} else if (reqs[i] == "CHEM") {
				newReqs.push("Chemistry");
			} else if (reqs[i] == "LAB" || reqs[i] == "LAB2") {
				newReqs.push("Lab");
			} else if (reqs[i] == "PHY1") {
				newReqs.push("Physics-1");
			} else if (reqs[i] == "PHY2") {
				newReqs.push("Physics-2");
			} else if (reqs[i] == "REST") {
				newReqs.push("REST");
			}
		}
	}

	item['comm_req_attribute'] = newReqs;
    }

    item['in-charge'] = item['in-charge'] + " (Class Admin)"

    if (term == 'FA') { item.Instructor = item.fall_instructors; }
    else { item.Instructor = item.spring_instructors; }

    if ('equivalent_subjects' in item) {
        item.equivalent_subjects = courseArrayToLinks(item.equivalent_subjects);
    }

    if ('timeAndPlace' in item) {
        if (item.timeAndPlace.search(/ARRANGED/) >= 0 || item.timeAndPlace.search(/null/) >= 0) {
            item.timeAndPlace = 'To be arranged';
        }
    }
    if ('units' in item && item.is_variable_units == 'Y') {
        item['units'] = 'Arranged';
        item['total-units'] = 'Arranged';
    }

    if ('offering' in item) {
        item.offering = ((item.offering == 'Y') ? "Currently Offered" : "Not Offered This Term");
    }

    if (item.level == "High Graduate") {
	item.level = "Graduate";
    }

    if (item.type == 'LectureSession') {
        item["lecture-section-of"] = item["section-of"];
        processBeginningTime(item.timeAndPlace, item["section-of"]);
        delete item["section-of"];
    }
    else if (item.type == 'RecitationSession') {
        item["rec-section-of"] = item["section-of"];
        delete item["section-of"];
    }
    else if (item.type == 'LabSession') {
        item["lab-section-of"] = item["section-of"];
        delete item["section-of"];
    }
}


// Puts a string of prereqs into correct URL format so can be links
function processPrereqs(prereqs, coords) {
    coords = coords || null;
    if (prereqs == "") {
        prereqs = "--";
    }
    else {
        while (prereqs.search(/GIR:/) >= 0) {
            gir = prereqs.match(/GIR:.{4}/);
            prereqs = prereqs.replace(/GIR:.{4}/, girData[gir].join(" or "));
        }
        while (prereqs.search(/[\]\[]/) >= 0 ) {
            prereqs = prereqs.replace(/[\]\[]/, "");
        }
    }
    // Makes prereqs appear as links
    prereqs = coursesToLinks(prereqs, coords);
    return prereqs;
}

//Parse a list of courses to links
function courseArrayToLinks(array, coords) {
    coords = coords || null;
    string = array.join(',, ');
    string = coursesToLinks(string);
    return string.split(',, ');
}

//makes the link that shows up as a bubble when the prereq link is clicked
function coursesToLinks(courseString, coords) {
    coords = coords || null;
    // Any number of spaces followed by any number of digits
    // followed by, optionally, a letter
    var courseArray = courseString.match(/([^\s\/]+\.[\d]+\w?)/g);
    if (courseArray != null) {
        var string = courseString;
        var output = '';
        var upTo = 0;
        for (var c=0; c<courseArray.length; c++) {
            var course = courseArray[c];
            var index = string.indexOf(course, upTo);
            var replacement = '<a href=\'javascript:{}\' onclick=\'showPrereq(this, "' + course.replace(/J/, '') + '", ' + coords + ');\'>' + course + '</a>';
            // string.substring(upTo, index) is everything not being replaced
            output += string.substring(upTo, index) + replacement;
            upTo = index + course.length;
        }
        courseString = output + string.substring(upTo);
    }
    return courseString;
}

function processClassesByTime() {
    var db = window.database;
    var items_in_db = db._items.toArray();

    for (var i in items_in_db) {
        var item = items_in_db[i];
        if (item.match("^L")) {
            var timeAndPlace = db.getObject(item, "timeAndPlace");
            var sectionOf = db.getObject(item, "lecture-section-of");
            if (timeAndPlace != null && sectionOf != null) {
                processBeginningTime(timeAndPlace, sectionOf);
            }
        }
    }
}

/*
    Function for processing the classes to fit within time slots
*/
function processBeginningTime(t, section) {
    if (t != null && t != undefined) {
	var beg = t.split("-")[0];
	var half = false;
	var time = "";

	if (beg != "To be arranged" && beg.indexOf("SELECTED") === -1) {
	    var days = [];
	    var validDay = /^[a-zA-Z]+$/;
	    if (beg.indexOf(' ') === -1 && beg.indexOf(",") === -1) {
		beg = beg.split(".")[0].split("");
	    } else if (beg.indexOf('EVE') != -1) {
		var parts = beg.split(" ");
		beg = (parts[0] + (parseInt(parts[2].split("(")[1]) + 12) + "").split("");
	    } else {
		if (beg.indexOf(",") === -1)
		    beg = beg.split(" ")[0].split("");
		else {
		    beg = beg.split(" ")[0].split(",");
		    for (item in beg)
			processBeginningTime(beg[item], section);
		    beg = [];
		}
	    }
	    for (c in beg) {
		if (beg[c].match(validDay)) {
		    days.push(beg[c]);
		} else {
		    if (!half) {
			time = time + beg[c];
			if (beg[c] == ".")
			    half = true;
		    }
		}
	    }
	    if (parseInt(time) < 8) {
		time = parseInt(time) + 12;
	    }
	    for (d in days) {
		if (classes_by_time[days[d]+time] == null)
		    classes_by_time[days[d]+time] = [];
		classes_by_time[days[d]+time].push(section);
	    }
	}
    }
}

//Turns a class name with a letter into just a number so it can be sorted by exhibit
function parseNumber(num) {
    numNoLetters = "";
    counter = 0;
    for (l in num) {
        if (!num.charAt(l).match("[a-zA-Z]+")) {
            numNoLetters += num.charAt(l);
        } else {
            counter = 100;
        }
    }
    if (numNoLetters != ".")
        return parseFloat(numNoLetters) + counter;
    else
        return counter;
}

