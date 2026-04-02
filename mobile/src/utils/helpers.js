const normalizeDisplayName = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  return trimmed.toLowerCase() === 'untitled' ? '' : trimmed;
};

const titleCase = (str) =>
  str
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
        .join('-')
    )
    .join(' ');

export const generateItemLabel = (item) => {
  if (!item) return '';
  const color = (item?.color_primary || item?.colorPrimary || '').trim();
  const subcategory = (item?.subcategory || '').trim();
  const category = (item?.category || '').trim();
  const material = (item?.material || '').trim();

  const parts = [];
  if (color && color.toLowerCase() !== 'unknown' && color.toLowerCase() !== 'n/a') {
    parts.push(color);
  }
  if (material && material.toLowerCase() !== 'unknown' && material.toLowerCase() !== 'n/a') {
    parts.push(material);
  }
  if (subcategory && subcategory.toLowerCase() !== 'unknown' && subcategory.toLowerCase() !== 'n/a') {
    parts.push(subcategory);
  } else if (category && category.toLowerCase() !== 'unknown' && category.toLowerCase() !== 'n/a') {
    parts.push(category);
  }

  if (parts.length === 0) return '';
  return titleCase(parts.join(' '));
};

export const transformItemsForDisplay = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    id: item?.id,
    name: normalizeDisplayName(item?.name || item?.item_name || ''),
    weather: item?.weather || item?.season || '',
    image: item?.image || item?.image_url || null,
  }));

