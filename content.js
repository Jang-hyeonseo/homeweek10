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

// GPT API Key
const GPT_API_KEY = "APIKEY";
const GPT_API_URL = "https://api.openai.com/v1/chat/completions";

// Function to update weather button position
function updateWeatherButtonPosition() {
    weatherButton.style.left = `${posX + 85}px`;
    weatherButton.style.top = `${posY - 20}px`;
}

// Function to move the pet
function movePet() {
    if (isPaused) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    posX += directionX * speed;
    posY += directionY * speed;

    if (posX + pet.offsetWidth > screenWidth || posX < 0) {
        directionX *= -1;
    }
    if (posY + pet.offsetHeight > screenHeight || posY < 0) {
        directionY *= -1;
    }

    pet.style.left = `${posX}px`;
    pet.style.top = `${posY}px`;

    updateWeatherButtonPosition();

    if (currentResponseBox) {
        currentResponseBox.style.left = `${posX}px`;
        currentResponseBox.style.top = `${posY - 100}px`;
    }
}

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
    // Base times: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
    let baseTime = '2300';  // Default to last time of previous day

    for (let i = baseTimes.length - 1; i >= 0; i--) {
        if (hour >= baseTimes[i]) {
            baseTime = String(baseTimes[i]).padStart(2, '0') + '00';
            break;
        }
    }
    return baseTime;
}

// Function to format date as YYYYMMDD
function getFormattedDate() {
    const now = new Date();
    const baseTime = getBaseTime();
    
    // If current hour is less than the first base time (02:00),
    // use yesterday's date
    if (now.getHours() < 2) {
        now.setDate(now.getDate() - 1);
    }
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return year + month + day;
}

// Function to get weather information
async function getWeatherInfo() {
    try {
        return await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: "getWeather" }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error("날씨 정보를 가져오는데 실패했습니다:", error);
        return null;
    }
}

// Function to create input box
function createInputBox() {
    if (currentInputBox) return;

    const inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.placeholder = "무엇이든 물어봐!";
    inputBox.className = "pet-input";
    inputBox.style.position = "absolute";
    inputBox.style.width = "200px";
    inputBox.style.zIndex = "1001";
    inputBox.style.top = `${posY - 30}px`;
    inputBox.style.left = `${posX}px`;
    inputBox.style.padding = "5px";
    inputBox.style.border = "1px solid #ccc";
    inputBox.style.borderRadius = "5px";
    inputBox.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";

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

            const loadingMessage = document.createElement("div");
            loadingMessage.innerText = "생각하는중..";
            loadingMessage.className = "pet-loading";
            loadingMessage.style.position = "absolute";
            loadingMessage.style.top = `${posY - 50}px`;
            loadingMessage.style.left = `${posX}px`;
            loadingMessage.style.backgroundColor = "#fff";
            loadingMessage.style.padding = "5px";
            loadingMessage.style.borderRadius = "5px";
            loadingMessage.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
            document.body.appendChild(loadingMessage);

            isPaused = true;
            const response = await sendInputToGPT(userInput);
            safeRemoveElement(loadingMessage);

            displayResponse(response);
        }
    });

    inputBox.addEventListener("blur", () => {
        setTimeout(() => {
            if (currentInputBox && document.body.contains(inputBox)) {
                safeRemoveElement(currentInputBox);
                currentInputBox = null;
                isPaused = false;
            }
        }, 100);
    });
}

// Function to display response
function displayResponse(response) {
    pet.src = chrome.runtime.getURL("images/click.gif");

    safeRemoveElement(currentResponseBox);
    currentResponseBox = null;

    const responseBox = document.createElement("div");
    responseBox.className = "pet-bubble";
    responseBox.style.position = "absolute";
    responseBox.style.top = `${posY - 100}px`;
    responseBox.style.left = `${posX}px`;
    responseBox.style.maxWidth = "200px";
    responseBox.style.backgroundColor = "#fff";
    responseBox.style.padding = "10px";
    responseBox.style.borderRadius = "5px";
    responseBox.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
    responseBox.style.zIndex = "1001";
    document.body.appendChild(responseBox);
    currentResponseBox = responseBox;

    let index = 0;
    const timer = setInterval(() => {
        if (index < response.length) {
            const char = response.charAt(index);
            if (char === '\n') {
                responseBox.appendChild(document.createElement('br'));
            } else {
                responseBox.appendChild(document.createTextNode(char));
            }
            index++;
        } else {
            clearInterval(timer);
            setTimeout(() => {
                safeRemoveElement(currentResponseBox);
                currentResponseBox = null;
                isPaused = false;
                pet.src = chrome.runtime.getURL("images/cat.gif");
            }, 3000);
        }
    }, 50);
}

// Function to send input to GPT API
async function sendInputToGPT(input) {
    try {
        const systemPrompt = "당신은 귀엽고 친근한 반려동물 마루입니다. 짧고 친근하게 대답해주세요.";
        const userPrompt = `${input}\n\n답변은 최대한 짧게, 친근하고 귀엽게 해주세요.`;

        const response = await fetch(GPT_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GPT_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 100,
            }),
        });

        const data = await response.json();
        return response.ok ? data.choices[0].message.content : "죄송해요, 답변하는데 문제가 생겼어요 😢";
    } catch (error) {
        console.error("Error:", error);
        return "네트워크 오류가 발생했어요 😢";
    }
}

// Handle pet click
pet.addEventListener("click", () => {
    if (!isPaused) {
        isPaused = true;
        createInputBox();
    }
});

// Handle weather button click
weatherButton.addEventListener("click", async () => {
    if (!isPaused) {
        isPaused = true;
        
        const loadingMessage = document.createElement("div");
        loadingMessage.innerText = "날씨 정보를 가져오는 중...";
        loadingMessage.className = "pet-loading";
        loadingMessage.style.position = "absolute";
        loadingMessage.style.top = `${posY - 50}px`;
        loadingMessage.style.left = `${posX}px`;
        loadingMessage.style.backgroundColor = "#fff";
        loadingMessage.style.padding = "5px";
        loadingMessage.style.borderRadius = "5px";
        loadingMessage.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";
        document.body.appendChild(loadingMessage);

        try {
            const weatherPromise = new Promise((resolve) => {
                chrome.runtime.sendMessage({ 
                    type: "getWeather",
                    data: {
                        base_date: getFormattedDate(),
                        base_time: getBaseTime(),
                        nx: 52,  // 제주도 격자 X 좌표
                        ny: 38   // 제주도 격자 Y 좌표
                    }
                }, response => {
                    resolve(response);
                });
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('날씨 정보 요청 시간이 초과되었습니다.')), 10000)
            );

            const weatherData = await Promise.race([weatherPromise, timeoutPromise]);
            safeRemoveElement(loadingMessage);

            if (weatherData && !weatherData.error) {
                const weatherText = `현재 날씨입니다!\n` +
                    `기온: ${weatherData.TMP || '알 수 없음'}\n` +
                    `하늘: ${getSkyStatus(weatherData.SKY) || '알 수 없음'}\n` +
                    `강수확률: ${weatherData.POP || '알 수 없음'}%\n` +
                    `습도: ${weatherData.REH || '알 수 없음'}%`;

                displayResponse(weatherText);
            } else {
                const errorMessage = weatherData?.error?.message || '날씨 정보를 가져오는데 실패했습니다.';
                displayResponse(`죄송해요, ${errorMessage} 😢`);
            }
        } catch (error) {
            console.error("Weather fetch error:", error);
            safeRemoveElement(loadingMessage);
            displayResponse(`날씨 정보를 가져오는데 실패했어요 😢\n${error.message}`);
        }
    }
});

// Helper function to convert sky status code to text
function getSkyStatus(code) {
    const skyStatus = {
        '1': '맑음',
        '3': '구름많음',
        '4': '흐림'
    };
    return skyStatus[code] || '알 수 없음';
}

// Start the animation loop
setInterval(movePet, 20);

// Handle window resize
window.addEventListener('resize', () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (posX + pet.offsetWidth > screenWidth) {
        posX = screenWidth - pet.offsetWidth;
    }
    if (posY + pet.offsetHeight > screenHeight) {
        posY = screenHeight - pet.offsetHeight;
    }

    updateWeatherButtonPosition();
});