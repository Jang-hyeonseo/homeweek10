// Create the pet element
const pet = document.createElement("img");
pet.src = chrome.runtime.getURL("images/cat.gif");
pet.style.position = "fixed";
pet.style.width = "100px";
pet.style.height = "auto";
pet.style.zIndex = "1000";
pet.style.top = "50px";
pet.style.left = "50px";
document.body.appendChild(pet);

// Create weather button
const weatherButton = document.createElement("img");
weatherButton.src = chrome.runtime.getURL("images/weather.png");
weatherButton.style.position = "fixed";
weatherButton.style.width = "30px";
weatherButton.style.height = "30px";
weatherButton.style.zIndex = "1000";
weatherButton.style.cursor = "pointer";
weatherButton.style.top = "30px";
weatherButton.style.left = "85px";
document.body.appendChild(weatherButton);

// Movement variables
let directionX = 1;
let directionY = 1;
let speed = 3;
let posX = 50;
let posY = 50;
let isPaused = false;
let currentInputBox = null;
let currentResponseBox = null;

// GPT API and Weather configurations are no longer hardcoded.
const GPT_API_URL = "https://api.openai.com/v1/chat/completions";

// Function to safely remove an element
function safeRemoveElement(element) {
    if (element && document.body.contains(element)) {
        document.body.removeChild(element);
    }
}

// Function to get current time in HHMM format
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return hours + minutes;
}

// Function to get base_time for API
function getBaseTime() {
    const hour = new Date().getHours();
    const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
    let baseTime = "2300";

    for (let i = baseTimes.length - 1; i >= 0; i--) {
        if (hour >= baseTimes[i]) {
            baseTime = String(baseTimes[i]).padStart(2, '0') + "00";
            break;
        }
    }
    return baseTime;
}

// Function to format date as YYYYMMDD
function getFormattedDate() {
    const now = new Date();
    if (now.getHours() < 2) {
        now.setDate(now.getDate() - 1);
    }
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return year + month + day;
}

// Function to create input box
function createInputBox() {
    if (currentInputBox) return;

    const inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.placeholder = "무엇이든 물어봐!";
    inputBox.style.position = "absolute";
    inputBox.style.width = "200px";
    inputBox.style.top = `${posY - 30}px`;
    inputBox.style.left = `${posX}px`;
    inputBox.style.padding = "5px";
    inputBox.style.border = "1px solid #ccc";
    inputBox.style.borderRadius = "5px";
    document.body.appendChild(inputBox);
    inputBox.focus();
    currentInputBox = inputBox;

    inputBox.addEventListener("keydown", async (event) => {
        if (event.key === "Enter" && currentInputBox) {
            event.preventDefault();
            const userInput = inputBox.value.trim();
            if (!userInput) return;

            safeRemoveElement(currentInputBox);
            currentInputBox = null;

            displayLoadingMessage();
            const response = await sendInputToGPT(userInput);
            displayResponse(response);
        }
    });
}

// Function to display response
function displayResponse(response) {
    safeRemoveElement(currentResponseBox);
    currentResponseBox = document.createElement("div");
    currentResponseBox.textContent = response;
    currentResponseBox.style.position = "absolute";
    currentResponseBox.style.top = `${posY - 100}px`;
    currentResponseBox.style.left = `${posX}px`;
    currentResponseBox.style.padding = "10px";
    document.body.appendChild(currentResponseBox);

    setTimeout(() => {
        safeRemoveElement(currentResponseBox);
        currentResponseBox = null;
        isPaused = false;
        pet.src = chrome.runtime.getURL("images/cat.gif");
    }, 5000);
}

// Function to send input to GPT API
async function sendInputToGPT(input) {
    try {
        const response = await fetch(GPT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${await getGPTAPIKey()}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: "친근하게 대답해주세요." }, { role: "user", content: input }],
                max_tokens: 100
            })
        });

        const data = await response.json();
        if (response.ok) return data.choices[0].message.content;
        else throw new Error(data.error.message || "응답 실패");
    } catch (error) {
        console.error("Error:", error);
        return "응답이 불가능합니다.";
    }
}

// Function to get GPT API Key securely
async function getGPTAPIKey() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "getAPIKey" }, (response) => {
            if (response.error) reject(response.error);
            else resolve(response.key);
        });
    });
}

// Function to fetch weather data
async function fetchWeatherInfo() {
    // Similar API call as shown in the previous code
}

// Handle pet click
pet.addEventListener("click", createInputBox);

// Handle weather button click
weatherButton.addEventListener("click", async () => {
    const weatherData = await fetchWeatherInfo();
    if (weatherData) {
        displayResponse(`날씨 정보\n기온: ${weatherData.TMP}`);
    } else {
        displayResponse("날씨 정보를 가져올 수 없습니다.");
    }
});

// Movement logic
function movePet() {
    if (isPaused) return;
    posX += directionX * speed;
    posY += directionY * speed;
    pet.style.left = `${posX}px`;
    pet.style.top = `${posY}px`;
}
setInterval(movePet, 20);
