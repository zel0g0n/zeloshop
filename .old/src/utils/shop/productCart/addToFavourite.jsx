
export function toggleFavourite(product) {
  const existingFavorites = JSON.parse(localStorage.getItem("favorites")) || [];
  const isAlreadyFavorite = existingFavorites.some((fav) => fav.id === product.id);
  if (isAlreadyFavorite) {
    const updatedFavorites = existingFavorites.filter((fav) => fav.id !== product.id);
    localStorage.setItem("favorites", JSON.stringify([updatedFavorites]));
  } else {
    localStorage.setItem("favorites", JSON.stringify([...existingFavorites, product]));
  }
  window.dispatchEvent(new Event("favorites_updated"));
}