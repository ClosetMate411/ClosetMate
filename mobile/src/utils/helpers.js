export const transformItemsForDisplay = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    id: item?.id,
    name: item?.name || item?.item_name || 'Untitled',
    weather: item?.weather || item?.season || 'Untitled',
    image: item?.image || item?.image_url || null,
  }));
