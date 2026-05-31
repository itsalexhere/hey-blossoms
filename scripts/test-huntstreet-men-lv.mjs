import { HuntstreetScraper } from '../utils/scrapers/huntstreet.js';

const url = 'https://www.huntstreet.com/shop/men?designer=LVU';
const scraper = new HuntstreetScraper({ headless: true, maxPages: 1, gender: 'men', brand: 'Louis Vuitton' });
const products = await scraper.scrape(url);
console.log('Total:', products.length);
if (products[0]) console.log(JSON.stringify(products[0], null, 2));
