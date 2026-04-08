// State
let state = {
  view: window.location.hash === '#favorites' ? 'favorites' : 'home',
  loading: false,
  query: sessionStorage.getItem('query') || '',
  recipes: JSON.parse(sessionStorage.getItem('recipes') || '[]'),
  searched: sessionStorage.getItem('searched') === 'true',
  vegOnly: false,
  expandedId: null,
  countries: [],
  favorites: JSON.parse(localStorage.getItem('favorites') || '[]')
};

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Elements
const appDiv = document.getElementById('app');
const navHome = document.getElementById('nav-home');
const navFavs = document.getElementById('nav-favs');
const favCountBadge = document.getElementById('fav-count-badge');

// Initialization
async function init() {
  updateNav();
  updateFavBadge();
  render();
  
  try {
    const res = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?a=list");
    const data = await res.json();
    state.countries = data.meals.map(m => m.strArea);
    if (state.view === 'home') render();
  } catch (err) {
    console.error(err);
  }
}

// Navigation & routing
window.addEventListener('hashchange', () => {
  state.view = window.location.hash === '#favorites' ? 'favorites' : 'home';
  state.expandedId = null; // reset expanded on navigation
  updateNav();
  render();
});

function updateNav() {
  if (state.view === 'home') {
    navHome.classList.add('active');
    navFavs.classList.remove('active');
  } else {
    navHome.classList.remove('active');
    navFavs.classList.add('active');
  }
}

function updateFavBadge() {
  if (state.favorites.length > 0) {
    favCountBadge.style.display = 'inline-block';
    favCountBadge.textContent = state.favorites.length;
  } else {
    favCountBadge.style.display = 'none';
  }
}

// State updates
function setState(newState) {
  state = { ...state, ...newState };
  
  // Persist to storage
  sessionStorage.setItem('recipes', JSON.stringify(state.recipes));
  sessionStorage.setItem('searched', state.searched);
  sessionStorage.setItem('query', state.query);
  localStorage.setItem('favorites', JSON.stringify(state.favorites));
  
  updateFavBadge();
  render();
}

// API Functions
async function searchRecipes() {
  if (!state.query.trim()) return;
  setState({ loading: true });
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${state.query}`);
    const data = await res.json();
    setState({ recipes: data.meals || [] });
  } catch (err) {
    console.error(err);
  } finally {
    setState({ loading: false, searched: true });
  }
}

async function getRandomMeal() {
  setState({ loading: true });
  try {
    const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
    const data = await res.json();
    setState({ recipes: data.meals || [], searched: true });
  } finally {
    setState({ loading: false });
  }
}

async function searchByCountry(country) {
  if (!country) return;
  setState({ loading: true });
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${country}`);
    const data = await res.json();
    const basicMeals = data.meals || [];
    const detailed = await Promise.all(
      basicMeals.map(async (meal) => {
        const r = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
        const d = await r.json();
        return d.meals[0];
      })
    );
    setState({ recipes: detailed, searched: true });
  } finally {
    setState({ loading: false });
  }
}

async function searchByLetter(letter) {
  setState({ loading: true });
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
    const data = await res.json();
    setState({ recipes: data.meals || [], searched: true });
  } finally {
    setState({ loading: false });
  }
}

// Actions
function toggleFavorite(mealId) {
  const meal = (state.view === 'favorites' ? state.favorites : state.recipes).find(m => m.idMeal === mealId) || state.favorites.find(m => m.idMeal === mealId);
  if (!meal) return;
  
  const isFav = state.favorites.some(f => f.idMeal === mealId);
  const updated = isFav
    ? state.favorites.filter(f => f.idMeal !== mealId)
    : [...state.favorites, meal];
    
  setState({ favorites: updated });
}

function toggleExpand(mealId) {
  setState({ expandedId: state.expandedId === mealId ? null : mealId });
}

// Event Delegation
appDiv.addEventListener('click', (e) => {
  // Navigation internal links
  const toggleBtn = e.target.closest('[data-toggle-id]');
  if (toggleBtn) {
    toggleExpand(toggleBtn.dataset.toggleId);
    return;
  }
  
  const favBtn = e.target.closest('[data-fav-id]');
  if (favBtn) {
    toggleFavorite(favBtn.dataset.favId);
    return;
  }
  
  if (e.target.closest('#btn-search')) {
    searchRecipes();
  } else if (e.target.closest('#btn-random')) {
    getRandomMeal();
  }
  
  const letterBtn = e.target.closest('.letter-btn');
  if (letterBtn && e.target.dataset.letter) {
    searchByLetter(e.target.dataset.letter);
  }
});

appDiv.addEventListener('input', (e) => {
  if (e.target.id === 'search-input') {
    state.query = e.target.value;
    // Don't re-render on every keystroke to keep focus, just update state seamlessly
    sessionStorage.setItem('query', state.query);
  } else if (e.target.id === 'veg-checkbox') {
    setState({ vegOnly: e.target.checked });
  }
});

appDiv.addEventListener('change', (e) => {
  if (e.target.id === 'country-select') {
    searchByCountry(e.target.value);
  }
});

appDiv.addEventListener('keydown', (e) => {
  if (e.target.id === 'search-input' && e.key === 'Enter') {
    searchRecipes();
  }
});

// Render Functions
function render() {
  if (state.view === 'favorites') {
    appDiv.innerHTML = renderFavorites();
  } else {
    appDiv.innerHTML = renderHome();
  }
}

function renderSearchBar() {
  return `
    <div class="search-container">
      <input type="text" id="search-input" value="${state.query.replace(/"/g, '&quot;')}" placeholder="Search by ingredient or meal..." class="search-input" />
      <button id="btn-search" class="btn-primary">Search</button>
    </div>
  `;
}

function renderRecipeCard(meal) {
  const isExpanded = state.expandedId === meal.idMeal;
  const isFavorite = state.favorites.some(f => f.idMeal === meal.idMeal);
  
  return `
    <div class="card">
      <div class="card-img-container">
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img" loading="lazy" />
        <div class="card-badges">
          ${meal.strCategory ? `<span class="badge">${meal.strCategory}</span>` : ''}
        </div>
      </div>
      <div class="card-content">
        <h2 class="card-title">${meal.strMeal}</h2>
        ${meal.strArea ? `<p class="card-subtitle">🌍 ${meal.strArea} cuisine</p>` : ''}
        <div class="card-actions">
          <button data-toggle-id="${meal.idMeal}" class="btn-card btn-view">
            ${isExpanded ? 'Hide ▲' : 'View Recipe ▼'}
          </button>
          <button data-fav-id="${meal.idMeal}" class="btn-card btn-save ${isFavorite ? 'active' : ''}">
            ${isFavorite ? '★ Saved' : '☆ Save'}
          </button>
        </div>
        ${isExpanded ? `
          <div class="card-expanded">
            ${meal.strInstructions ? `
              <div>
                <p class="instructions-label">Instructions</p>
                <p class="instructions-text">${meal.strInstructions.slice(0, 300)}...</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderRecipeGrid(recipesToRender) {
  if (recipesToRender.length === 0) return '';
  return `
    <div class="grid">
      ${recipesToRender.map(renderRecipeCard).join('')}
    </div>
  `;
}

function renderHome() {
  const displayedRecipes = state.vegOnly
    ? state.recipes.filter(r => r.strCategory === 'Vegetarian')
    : state.recipes;
    
  let html = '';
  
  if (!state.searched) {
    html += `
      <div class="hero">
        <p class="subtitle">Discover • Cook • Enjoy</p>
        <h1>Find Your Next<br/><span>Favorite Meal</span></h1>
        <p class="desc">Search thousands of recipes by ingredient, cuisine, or just let us surprise you.</p>
        ${renderSearchBar()}
        
        <div class="filters-row">
          <label class="checkbox-label">
            <input type="checkbox" id="veg-checkbox" ${state.vegOnly ? 'checked' : ''} />
            🥦 Vegetarian only
          </label>
          <button id="btn-random" class="btn-secondary">🎲 Random Meal</button>
          <select id="country-select" class="select-input">
            <option value="">🌍 By Country</option>
            ${state.countries.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        
        <div class="letter-browse">
          ${alphabet.map(letter => `<button class="letter-btn" data-letter="${letter}">${letter.toUpperCase()}</button>`).join('')}
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="top-search-bar">
        <div class="container">
          <div class="search-wrapper">
            ${renderSearchBar()}
          </div>
          <label class="checkbox-label">
            <input type="checkbox" id="veg-checkbox" ${state.vegOnly ? 'checked' : ''} />
            🥦 Vegetarian only
          </label>
          <button id="btn-random" class="btn-secondary">🎲 Random</button>
          <select id="country-select" class="select-input">
            <option value="">🌍 By Country</option>
            ${state.countries.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
    `;
    
    if (state.loading) {
      html += `
        <div class="text-center py-32">
          <p class="animate-pulse loading-text">Finding recipes...</p>
        </div>
      `;
    } else if (state.recipes.length === 0) {
      html += `
        <div class="text-center py-32">
          <p class="empty-icon">🍽️</p>
          <p class="empty-title">No recipes found.</p>
          <p class="empty-subtitle">Try "chicken", "pasta", or browse by letter</p>
        </div>
      `;
    } else if (displayedRecipes.length > 0) {
      html += `
        <div class="max-w-6xl px-8 py-10">
          <p class="results-count">${displayedRecipes.length} recipes found</p>
          ${renderRecipeGrid(displayedRecipes)}
        </div>
        
        <div class="bottom-letter-bar">
          <p class="bottom-letter-label">Browse by letter</p>
          <div class="letter-browse" style="margin-top: 0; justify-content: flex-start;">
            ${alphabet.map(letter => `<button class="letter-btn" data-letter="${letter}">${letter.toUpperCase()}</button>`).join('')}
          </div>
        </div>
      `;
    }
  }
  
  return html;
}

function renderFavorites() {
  let html = `
    <div class="max-w-6xl px-8 py-10">
      <h2 class="text-4xl mb-2 heading-favorites">Your Favorites</h2>
      <p class="text-dim mb-8">${state.favorites.length} saved recipes</p>
  `;
  
  if (state.favorites.length === 0) {
    html += `
      <div class="text-center py-32">
        <p class="empty-icon">🤍</p>
        <p class="empty-title">No favorites yet.</p>
        <p class="empty-subtitle">Search for recipes and hit Save to add them here.</p>
      </div>
    `;
  } else {
    html += renderRecipeGrid(state.favorites);
  }
  
  html += `</div>`;
  return html;
}

// Start
init();
