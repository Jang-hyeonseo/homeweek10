// background.js
chrome.runtime.onInstalled.addListener(() => {
    console.log("Maru Browser Pet installed!");
});

// Weather API configuration
const WEATHER_API_KEY = "ZIm/L9DxUphsfnmgLGnnXeX+LW51PRMAwyUF5R2LFR1ZAknjj+GeTbp1n7TEwRtdXm5VIvyGp2gakFhmgmEWCw==";
const WEATHER_BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

// Function to convert sky status code to text
function getSkyStatus(code) {
    const skyStatus = {
        '1': '맑음',
        '3': '구름많음',
        '4': '흐림'
    };
    return skyStatus[code] || '알 수 없음';
}

// Function to get current base time
function getBaseTime(hours) {
    // Base times: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    if (hours < 2) return "2300";
    else if (hours < 5) return "0200";
    else if (hours < 8) return "0500";
    else if (hours < 11) return "0800";
    else if (hours < 14) return "1100";
    else if (hours < 17) return "1400";
    else if (hours < 20) return "1700";
    else if (hours < 23) return "2000";
    else return "2300";
}

// Function to fetch weather data

function parseXMLString(xmlString) {
    // 간단한 XML 파서
    const getValue = (xml, tag) => {
        const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`);
        const match = xml.match(regex);
        return match ? match[1] : null;
    };

    const getItems = (xml) => {
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            items.push({
                category: getValue(itemXml, 'category'),
                fcstTime: getValue(itemXml, 'fcstTime'),
                fcstValue: getValue(itemXml, 'fcstValue')
            });
        }

        return items;
    };

    // Extract resultCode and resultMsg
    const resultCode = getValue(xmlString, 'resultCode');
    const resultMsg = getValue(xmlString, 'resultMsg');
    const items = getItems(xmlString);

    return { resultCode, resultMsg, items };
}

// Function to fetch weather data
async function fetchWeather(params) {
    try {
        console.log("Starting weather fetch...");
        
        // Get current date and time
        const now = new Date();
        const baseDate = params?.base_date || now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');

        // Get base time
        const hours = now.getHours();
        const baseTime = params?.base_time || getBaseTime(hours);

        // Adjust date if using previous day's last forecast
        let finalBaseDate = baseDate;
        if (hours < 2) {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            finalBaseDate = yesterday.getFullYear() +
                String(yesterday.getMonth() + 1).padStart(2, '0') +
                String(yesterday.getDate()).padStart(2, '0');
        }

        console.log("Request params:", {
            baseDate: finalBaseDate,
            baseTime: baseTime,
            nx: params?.nx || 52,
            ny: params?.ny || 38
        });

        // Build API URL
        const queryParams = new URLSearchParams({
            serviceKey: WEATHER_API_KEY,
            numOfRows: '1000',
            pageNo: '1',
            dataType: 'XML',
            base_date: finalBaseDate,
            base_time: baseTime,
            nx: params?.nx || 52,
            ny: params?.ny || 38
        });

        const apiUrl = `${WEATHER_BASE_URL}?${queryParams.toString()}`;
        console.log("Requesting URL:", apiUrl);

        const response = await fetch(apiUrl);
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const xmlText = await response.text();
        console.log("Received XML:", xmlText);

        // Parse XML
        const parsedData = parseXMLString(xmlText);
        
        if (parsedData.resultCode !== '00') {
            throw new Error(`API Error: ${parsedData.resultMsg} (${parsedData.resultCode})`);
        }

        // Process weather data
        const currentHour = String(now.getHours()).padStart(2, '0') + "00";
        const weatherInfo = {};

        // Find current time data
        parsedData.items.forEach(item => {
            if (item.fcstTime === currentHour) {
                switch(item.category) {
                    case 'TMP': // 기온
                        weatherInfo.TMP = item.fcstValue + '°C';
                        break;
                    case 'SKY': // 하늘상태
                        weatherInfo.SKY = item.fcstValue;
                        break;
                    case 'POP': // 강수확률
                        weatherInfo.POP = item.fcstValue;
                        break;
                    case 'REH': // 습도
                        weatherInfo.REH = item.fcstValue;
                        break;
                }
            }
        });

        console.log("Processed weather info:", weatherInfo);

        // Validate that we have all required information
        const requiredFields = ['TMP', 'SKY', 'POP', 'REH'];
        const missingFields = requiredFields.filter(field => !weatherInfo[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing weather data: ${missingFields.join(', ')}`);
        }

        return weatherInfo;

    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        throw error;
    }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received message:", request);
    if (request.type === "getWeather") {
        fetchWeather(request.data)
            .then(weatherData => {
                console.log("Sending weather data:", weatherData);
                sendResponse(weatherData);
            })
            .catch(error => {
                console.error("Error in fetchWeather:", error);
                sendResponse({
                    error: true,
                    message: error.message
                });
            });
        return true; // Will respond asynchronously
    }
});

// Error handler for unhandled promise rejections
self.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
});