import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN;

async function testSearch(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
  const res = await axios.get(url, {
    params: {
      access_token: MAPBOX_TOKEN,
      autocomplete: true,
      limit: 8,
      language: 'pt',
      country: 'br',
      types: 'address,poi,place,locality,neighborhood',
      proximity: '-47.4145,-22.7562', // Proximity to SBO/Americana area
    },
  });
  console.log('Results for:', query);
  res.data.features.forEach(f => {
    console.log(`- ${f.place_name} (${f.center}) [Type: ${f.place_type}]`);
  });
}

testSearch('Atacadão - Santa Barbara');
testSearch('Atacadão');
