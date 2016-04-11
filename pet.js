'use strict';

var fs = require('fs');
var util = require('util');

// This will add .red, .green etc. to the String prototype.
require('colors');

//
// log - a micro-library for logging
//
// log('stuff')
// log('stuff', [1, 2, 'more']); // all logging methods understand multiple arguments, like console.log
// log.e('error (in red)');
// log.s('successful (in green)');
// log.i('important/info (typically data explaining the error)');
//

function log() {
	console.log.apply(console, arguments);
}

log.formatArgs = function(args) {
	return [].slice.apply(args).map(function(arg) {
		return typeof arg === 'object' ? util.inspect(arg) : String(arg)
	}).join(' ');
}

// Log erroneous stuff (in red)
log.e = function() {
	this(this.formatArgs(arguments).red);
};

// Log successful stuff (in green)
log.s = function() {
	this(this.formatArgs(arguments).green);
};

// Log important stuff (in a visible color)
log.i = function() {
	this(this.formatArgs(arguments).magenta);
};

//
// assert - a micro-library for failing with grace
//
// assert(fact);
// assert.eq(actual, expected);
// assert.eq(actual, expected, 'amount of bananas');
//

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
//     assert.eq(data.howManyApples, 3, 'amount of apples');
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


// Convert a step description, e.g.
//
//   'I see $text and $moreText',
//
// into a regular expression that matches strings or numbers, such as like
//
//   'I see "abc" and "xyz"',
//
// capturing "abc" and "xyz" with the regular expression.
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

var steps = [];

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

// Return a parsed line (or undefined, in which case line should be ignored)
function parse(line, lineNumber) {
	if (isCommentedOut(line)) {
		return;
	}
	var trimmed = line.trim();
	if (!trimmed) {
		return;
	}

	var matchTest = trimmed.match(/^test ['"](.*)['"]$/);
	var matchStep = trimmed.match(/^(?:given|when|then|and) (.*)$/);

	if (matchTest) {
		return {
			type: 'test',
			test: matchTest[1]
		};
	} else if (matchStep) {
		//log('finding step for line', idx + ':', match[1]);
		var result = findStep(matchStep[1]);
		result.type = 'step';
		if (!result) {
			throw new Error('No step matches line ' + lineNumber + ': ' + line);
		}
		log('parsed', result);
		return result;
	} else {
		throw new Error('Syntax error on line ' + lineNumber + ': ' + line);
	}
}

require('./test.pet.js');

var filename = 'test.pet';
var test = fs.readFileSync(filename, 'utf8');

var lines = test.replace(/\n$/, '').split("\n");

var currentTest = null;
var tests = [];

try {
	lines.forEach(function(line, idx) {
		var lineNumber = idx + 1;
		var location = filename + ':' + lineNumber;
		var parsed = parse(line, lineNumber);

		if (!parsed) {
			return;
		}

		if (parsed.type === 'test') {
			currentTest = {
				name: parsed.test,
				steps: []
			}
			tests.push(currentTest);
		} else if (parsed.type === 'step') {
			//log("Step parsed.", parsed.step.f, parsed.args);
			if (!currentTest) {
				throw new Error(location + ': ' + line + '\nEncountered a step without a test');
			}
			currentTest.steps.push({
				location: location,
				line: line,
				f: parsed.step.f,
				what: parsed.step.what,
				args: parsed.args
			});
		} else {
			throw new Error(location + ': strange line: ' + parsed.type);
		}
	});
} catch (e) {
	log.e(e.message);
}

var stepPromise = Promise.resolve();

function StepError(step, originalError) {
	this.step = step;
	this.originalError = originalError;
}


function formatLine(step) {
	return step.location + '> ' + step.line;
}

for (let test of tests) {
	let context = {};
	for (let step of test.steps) {
		stepPromise = stepPromise.then(function() {
			log(formatLine(step, step));
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
}

stepPromise.then(function() {
	log('\nAll tests run successfully!'.green);
}).catch(function(err) {
	if (err instanceof StepError) {
		var originalError = err.originalError;
		log.i('\nStep failed:\n');
		log.e(formatLine(err.step));
		var message = originalError.message || originalError;
		log.i(`\nReason: ${message}`);
		log.i(`\nFailing step: '${err.step.what}':`, err.step.f);
		log.i(`\nContext at point of failure: ${util.inspect(context)}`);
		if (originalError.stack) {
			log.i('\nStacktrace:\n', originalError.stack);
		}
	} else {
		log.i('\nSomething went wrong:', err);
		log.i(err.stack);
	}
	process.exit(1);
});




