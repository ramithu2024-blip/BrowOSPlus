// Clock app

const clockAppTime = document.getElementById("clockAppTime");

const clockAppDate = document.getElementById("clockAppDate");

function updateClockApp() {
	const now = new Date();

	clockAppTime.textContent = now.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	clockAppDate.textContent = now.toLocaleDateString([], {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

updateClockApp();

setInterval(updateClockApp, 1000);

function twoDigits(number) {
	return String(number).padStart(2, "0");
}

// Stopwatch

const stopwatchTime = document.getElementById("stopwatchTime");

const stopwatchStartButton = document.getElementById("stopwatchStartButton");

const stopwatchResetButton = document.getElementById("stopwatchResetButton");

let stopwatchRunning = false;
let stopwatchStart = 0;
let stopwatchElapsed = 0;
let stopwatchInterval = null;

function updateStopwatch() {
	let total = stopwatchElapsed;

	if (stopwatchRunning) {
		total += Date.now() - stopwatchStart;
	}

	const minutes = Math.floor(total / 60000);

	const seconds = Math.floor(total / 1000) % 60;

	const hundredths = Math.floor(total / 10) % 100;

	stopwatchTime.textContent =
		twoDigits(minutes) + ":" + twoDigits(seconds) + "." + twoDigits(hundredths);
}

stopwatchStartButton.addEventListener("click", function () {
	if (stopwatchRunning) {
		stopwatchElapsed += Date.now() - stopwatchStart;

		stopwatchRunning = false;

		clearInterval(stopwatchInterval);

		stopwatchStartButton.textContent = "Start";
	} else {
		stopwatchStart = Date.now();

		stopwatchRunning = true;

		stopwatchInterval = setInterval(updateStopwatch, 10);

		stopwatchStartButton.textContent = "Stop";
	}

	updateStopwatch();
});

stopwatchResetButton.addEventListener("click", function () {
	clearInterval(stopwatchInterval);

	stopwatchRunning = false;
	stopwatchElapsed = 0;

	stopwatchStartButton.textContent = "Start";

	updateStopwatch();
});

// Timer

const timerTime = document.getElementById("timerTime");

const timerMinutes = document.getElementById("timerMinutes");

const timerStartButton = document.getElementById("timerStartButton");

const timerResetButton = document.getElementById("timerResetButton");

let timerRunning = false;
let timerEnd = 0;
let timerLeft = 5 * 60000;
let timerInterval = null;

function updateTimer() {
	if (timerRunning) {
		timerLeft = timerEnd - Date.now();

		if (timerLeft <= 0) {
			clearInterval(timerInterval);

			timerRunning = false;
			timerLeft = 0;

			timerStartButton.textContent = "Start";
			timerTime.textContent = "00:00";

			startupSound.currentTime = 0;
			startupSound.play().catch(() => {});

			showAlert("Time's up!");

			timerLeft = Number(timerMinutes.value) * 60000;
		}
	}

	const totalSeconds = Math.ceil(timerLeft / 1000);

	timerTime.textContent =
		twoDigits(Math.floor(totalSeconds / 60)) + ":" + twoDigits(totalSeconds % 60);
}

timerStartButton.addEventListener("click", function () {
	if (timerRunning) {
		timerLeft = timerEnd - Date.now();

		timerRunning = false;

		clearInterval(timerInterval);

		timerStartButton.textContent = "Start";
	} else {
		if (timerLeft <= 0) {
			return;
		}

		timerEnd = Date.now() + timerLeft;

		timerRunning = true;

		timerInterval = setInterval(updateTimer, 250);

		timerStartButton.textContent = "Pause";
	}

	updateTimer();
});

timerResetButton.addEventListener("click", function () {
	clearInterval(timerInterval);

	timerRunning = false;

	timerLeft = Number(timerMinutes.value) * 60000;

	timerStartButton.textContent = "Start";

	updateTimer();
});

timerMinutes.addEventListener("input", function () {
	if (!timerRunning) {
		timerLeft = Number(timerMinutes.value) * 60000;

		updateTimer();
	}
});
