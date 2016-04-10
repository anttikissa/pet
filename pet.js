'use strict';

var fs = require('fs');
var util = require('util');

var log = console.log.bind(console);

var steps = [];

function assert(fact) {
	if (!fact) {
		throw new Error("Assertion failed");
	}
}

// Assert that 'actual' and 'expected' appear equal when stringified.
// Works well for simple values, but be warned that e.g. { a: 1, b: 1 } is not equal to { b: 1, a: 1 }
//
// 'what' is an optional string describing the nature of compared values. Use it to get
// better error messages:
//
//     assert.eq(data.howManyApples, 3, "amount of apples");
//
// => "Expected amount of apples to be 3, but it was 0."
assert.eq = function(actual, expected, what) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		var actualString = util.inspect(actual);
		var expectedString = util.inspect(expected);
		if (what) {
			throw new Error("Expected " + what + " to be " + expectedString + ", but it was " + actualString);
		} else {
			throw new Error("Expected value to be " + expectedString + ", but it was " + actualString)
		}
	}
};

// Convert string literals like '"this"' into 'this' (likewise for double quotes),
// and number literals like "12345" into numbers.
function undressLiteral(literal) {
	if (literal[0] === '"' || literal[0] === "'") {
		assert(literal[0] === literal[literal.length-1]);
		return literal.slice(1, literal.length - 1);
	} else {
		var result = parseFloat(literal);
		assert(!isNaN(result));
		return result;
	}
}

function findStep(line) {
	for (var step of steps) {
		var match = step.recognizer.exec(line);
		if (match) {
			return {
				step: step,
				args: match.slice(1, match.length).map(undressLiteral)
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
	var result = what.replace(/(\$(\w|-)+)\b/g, function(/* match */) {
		//log('match', match);
		//This monster matches either "string constants" or 'string constants'
		// (like in JavaScript). It captures the whole thing, quotes included.
		var singleQuotedStringRegexp = "'(?:(?:\\.|[^'])*)'";
		var doubleQuotedStringRegexp = "\"(?:(?:\\.|[^\"])*)\"";
		var numberRegexp = "[-+]?[0-9]*\\.?[0-9]+";

		return "(" + singleQuotedStringRegexp + "|" + doubleQuotedStringRegexp + "|" + numberRegexp + ")";
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
	},

	assert: assert
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
		throw new Error('Syntax error on line ' + lineNumber + ': ' + line);
	}
	//log('finding step for line', idx + ':', match[1]);
	var result = findStep(match[1]);
	if (!result) {
		throw new Error('No step matches line ' + lineNumber + ': ' + line);
	}
	return result;
}

require('./test.pet.js');

var filename = 'test.pet';
var test = fs.readFileSync(filename, 'utf8');

var lines = test.replace(/\n$/, '').split("\n");

var stepsToRun = [];

lines.forEach(function(line, idx) {
	var lineNumber = idx + 1;
	var parsed = parse(line, lineNumber);
	if (!parsed) {
		return;
	}
	//log("Line parsed.", parsed.step.f, parsed.args);
	stepsToRun.push({
		location: filename + ':' + lineNumber,
		line: line,
		f: parsed.step.f,
		args: parsed.args
	});
});

var stepPromise = Promise.resolve();

function StepError(step, originalError) {
	this.step = step;
	this.originalError = originalError;
}

var context = {};

for (let step of stepsToRun) {
	stepPromise = stepPromise.then(function() {
		log(step.location + '>', step.line);
		return step.f.apply(context, step.args);
	}).catch(function(error) {
		if (!(error instanceof StepError)) {
			throw new StepError(step, error);
		} else {
			throw error;
		}
	});

	stepPromise.step = step;
}

stepPromise.then(function() {
	log('All tests run successfully!');
}).catch(function(err) {
	if (err instanceof StepError) {
		var originalError = err.originalError;
		log('\nStep failed:');
		log(err.step.location + '> ' + err.step.line);
		var message = originalError.message || originalError;
		log('Reason:', message);
		log('\nContext at point of failure:', context);
		if (originalError.stack) {
			log('\nStacktrace:\n', originalError.stack);
		}
	} else {
		log('\nSomething went wrong:', err);
		log(err.stack);
	}
	process.exit(1);
});




