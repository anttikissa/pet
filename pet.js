var fs = require('fs');
var log = console.log.bind(console);

var steps = [];

function assert(fact) {
	if (!fact) {
		throw new Error("assertion failed");
	}
}

function stripQuotes(string) {
	assert(string[0] === string[string.length-1]);
	assert(string[0] === '"' || string[0] === "'");
	return string.slice(1, string.length - 1);
}

function findStep(line) {
	for (var step of steps) {
		var match = step.recognizer.exec(line);
		if (match) {
			return {
				step: step,
				args: match.slice(1, match.length).map(stripQuotes)
			};
		}
	}
}

// Convert a step descriptions, e.g.
//
//   'I see $text and $moreText',
//
// into a regular expression that matches strings, like
//
//   'I see "abc" and "xyz"',
//
// capturing "abc" and "xyz".
function createRecognizer(what) {
	var result = what.replace(/(\$(\w|-)+)\b/g, function(match) {
		//log('match', match);
		//This monster matches either "string constants" or 'string constants'
		// (like in JavaScript). It captures the whole thing, quotes included.
		return "('(?:(?:\\.|[^'])*)'|\"(?:(?:\\.|[^\"])*)\")";
	});

	return new RegExp('^' + result + '$');
}

module.exports = {
	step: function(what, f) {
		var newStep = {
			what: what,
			f: f,
			recognizer: createRecognizer(what)
		};
		steps.push(newStep);

		//log('step', what);
	}
};

function isCommentedOut(line) {
	return line.trim()[0] === '#';
}

function parse(line, lineNumber) {
	if (isCommentedOut(line)) {
		return;
	}
	var match = line.trim().match(/^(?:given|when|then|and) (.*)$/);
	if (!match) {
		throw new Error('error on line ' + lineNumber + ': ' + line);
	}
	//log('finding step for line', idx + ':', match[1]);
	var result = findStep(match[1]);
	if (!result) {
		throw new Error('no step matches line ' + lineNumber + ': ' + line);
	}
	return result;
}

require('./test.pet.js');

var filename = 'test.pet';
var test = fs.readFileSync(filename, 'utf8');

var lines = test.replace(/\n$/, '').split("\n");

lines.forEach(function(line, idx) {
	var lineNumber = idx + 1;
	var parsed = parse(line, lineNumber);
	if (!parsed) {
		return;
	}
	log(filename + ':' + lineNumber, line);
	//log("Line parsed.", parsed.step.f, parsed.args);
	parsed.step.f.apply(null, parsed.args);
});




