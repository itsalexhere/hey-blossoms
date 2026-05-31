import { HuntstreetScraper } from '../utils/scrapers/huntstreet.js';

const url = 'https://www.huntstreet.com/shop/men?designer=DIH';
const scraper = new HuntstreetScraper({
    headless: true,
    maxPages: 1,
    gender: 'men',
    brand: 'Dior',
});

console.log('Testing:', url);
const products = await scraper.scrape(url);
console.log('Total:', products.length);
if (products[0]) {
    console.log('Sample:', JSON.stringify(products[0], null, 2));
}
