var pet = require('./pet');
var assert = pet.assert;
var step = pet.step;

step('I fail because $reason', function(reason) {
	//This works, too - if you want a stacktrace
	//throw new Error(reason);
	return Promise.reject(reason);
});

// Print message to console while saving amount of printed lines in context
function print(message, context) {
	if (!context.linesPrinted) {
		context.linesPrinted = 0;
	}

	if (!context.lines) {
		context.lines = [];
	}
	//console.log(message);
	context.linesPrinted++;
	context.lines.push(message);
}

step('I print $text', function(text) {
	print(text, this);
});

step('I print $text and I also print $somethingElse', function(text, somethingElse) {
	print(text, this);
	print(somethingElse, this);
});

step('I see $lines lines of output', function(lines) {
	assert.eq(this.linesPrinted, lines, "amount of lines printed");
});

step('I wait $ms milliseconds', function(ms) {
	return new Promise(function(resolve) {
		//console.log('wait start');
		setTimeout(function() {
			//console.log('wait end');
			resolve();
		}, ms);
	});
});

