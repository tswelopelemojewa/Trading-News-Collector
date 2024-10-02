const { Builder, By, until } = require('selenium-webdriver');
const sqlite3 = require('sqlite3').verbose();
const chrome = require('selenium-webdriver/chrome');
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.static('public'));



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`started on : ${PORT}`));

// Initialize SQLite database connection
let db = new sqlite3.Database('./market_news.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create the news table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT,
    summary TEXT,
    release_time TEXT,
    link TEXT
)`);

// Transform the date into a usable format and add 2 hours to match timezone
function formatDatetime(release_time) {
    const datePart = release_time.slice(4, 24); // Extracts 'Oct 01 2024 23:08:47'
    let dateObj = new Date(datePart);

    // Add 2 hours to the date object
    dateObj.setHours(dateObj.getHours() + 2);

    // Convert to the required format (YYYY-MM-DD HH:MM:SS)
    let formattedDate = dateObj.toISOString().slice(0, 19).replace('T', ' ');
    return formattedDate;
}

// Function to get the latest release_time in the database
function getLatestReleaseTime(callback) {
    db.get(`SELECT release_time FROM news ORDER BY release_time DESC LIMIT 1`, (err, row) => {
        if (err) {
            console.error(err.message);
            callback(null);
        } else {
            callback(row ? row.release_time : null);  // Return null if no rows are present
        }
    });
}

// Function to insert scraped news data into the SQLite database
function insertNews(headline, summary, release_time, link) {
    db.run(`INSERT INTO news (headline, summary, release_time, link) VALUES (?, ?, ?, ?)`,
        [headline, summary, release_time, link], (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log(`Inserted news: ${headline}`);
            }
        });
}

// Scraper function using Selenium WebDriver
async function scrapeMarketNews(driver) {
    try {
        await driver.get('https://analysis.hfm.com/en-za/market-news/');

        // Wait for the cookies popup and click the "Accept and Continue" button if it appears
        try {
            const acceptCookiesButton = await driver.wait(until.elementLocated(By.css('button.orejime-Button--save')), 5000);
            await acceptCookiesButton.click();
        } catch (err) {
            console.log('No cookies popup found.');
        }

        // Locate the news articles on the page
        await driver.wait(until.elementLocated(By.css('.sepH_a_line')), 10000);
        await driver.wait(until.elementLocated(By.css('ul')), 10000);
        let articles = await driver.findElements(By.css('.sepH_a_line'));

        // Get the latest release time from the database
        getLatestReleaseTime(async (latestReleaseTime) => {
            // console.log(`Latest release time in database: ${latestReleaseTime}`);

            for (let article of articles) {
                let headline = await article.findElement(By.css('h5.color-red')).getText();
                let summary = await driver.findElement(By.css('ul')).getText();
                let moreInfo = await driver.findElement(By.css('.fxs_headline_medium')).getText();
                let release_time = await article.findElement(By.css('span.g_color')).getText();

                // Format the release_time to a usable datetime format
                let formattedDatetime = formatDatetime(release_time);

                // Only insert news if its release_time is more recent than the latest in the database
                if (!latestReleaseTime || formattedDatetime > latestReleaseTime) {
                    insertNews(headline, summary, formattedDatetime, moreInfo);
                } 
                // else {
                //     console.log(`Skipping: ${headline} (Release time: ${formattedDatetime})`);
                // }
            }
        });
    } catch (error) {
        console.error(`Error during scraping: ${error.message}`);
    }
}

// Countdown function for displaying remaining time in the console
function startCountdown(duration, callback) {
    let remainingTime = duration;
    let countdownInterval = setInterval(() => {
        // let minutes = Math.floor(remainingTime / 60);
        // let seconds = remainingTime % 60;

        console.clear();
        // console.log(`Next scraping attempt in: ${minutes}m ${seconds}s`);

        remainingTime--;

        if (remainingTime < 0) {
            clearInterval(countdownInterval);
            callback();  // Call the scraping function after countdown ends
        }
    }, 1000);  // Update every second
}

// Function to run the scraper periodically with countdown
async function startScraper() {
    let options = new chrome.Options();
    options.addArguments('--headless');  // Run in headless mode
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    

    let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    // Define the interval between scraping attempts (e.g., 5 minutes = 300 seconds)
    const scrapeInterval = 120;  // 2 minutes

    // Infinite loop for continuous scraping with countdown
    (function repeatScraping() {
        // Start countdown and run scrapeMarketNews when it reaches 0
        startCountdown(scrapeInterval, async () => {
            await scrapeMarketNews(driver);

            // Restart the process after scraping is done
            repeatScraping();
        });
    })();
}

// Run the scraper continuously
startScraper().catch(err => {
    console.error(`Scraping failed: ${err.message}`);
}).finally(() => {
    // Keep the database connection open for continuous scraping
});
