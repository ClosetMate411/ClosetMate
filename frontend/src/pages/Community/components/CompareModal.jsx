import React, { memo, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal } from '@mantine/core';
import './CompareModal.css';

const CompareModal = ({ opened, onClose, feedItem, outfits, wardrobeItems }) => {
  const [selectedOutfitId, setSelectedOutfitId] = useState(null);

  const handleClose = () => {
    setSelectedOutfitId(null);
    onClose();
  };

  // Resolve community outfit images
  const communityItems = useMemo(() => {
    if (!feedItem) return [];
    const outfit = feedItem.outfit;
    if (outfit.items && outfit.items.length > 0) {
      return outfit.items.map((i) => ({
        id: i.id,
        name: i.name || 'Unknown',
        image: i.image_url,
      }));
    }
    return outfit.item_ids
      .map((id) => wardrobeItems.find((w) => w.id === id) || null)
      .filter(Boolean);
  }, [feedItem, wardrobeItems]);

  // Resolve selected user outfit images
  const selectedOutfit = useMemo(
    () => outfits.find((o) => o.id === selectedOutfitId) || null,
    [selectedOutfitId, outfits]
  );

  const myItems = useMemo(() => {
    if (!selectedOutfit) return [];
    return selectedOutfit.item_ids
      .map((id) => wardrobeItems.find((w) => w.id === id) || null)
      .filter(Boolean);
  }, [selectedOutfit, wardrobeItems]);

  if (!feedItem) return null;

  const communityOutfit = feedItem.outfit;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Compare Outfits"
      centered
      size="xl"
    >
      <div className="compare-modal">
        <div className="compare-modal-grid">
          {/* ── Community Outfit (Left) ── */}
          <div className="compare-modal-slot">
            <div className="compare-modal-slot-header">
              <span className="compare-modal-label">Community</span>
              <span className="compare-modal-author">{feedItem.shared_by.name}</span>
            </div>
            <div className="compare-modal-card">
              <h4 className="compare-modal-name">{communityOutfit.name}</h4>
              <div className="compare-modal-items">
                {communityItems.map((item) => (
                  <div key={item.id} className="compare-modal-item">
                    <img src={item.image} alt={item.name} loading="lazy" referrerPolicy="no-referrer" />
                    <span className="compare-modal-item-name">{item.name}</span>
                  </div>
                ))}
              </div>
              <div className="compare-modal-meta">
                <div className="compare-modal-tags">
                  {communityOutfit.style && <span className="meta-tag">{communityOutfit.style}</span>}
                  {communityOutfit.occasion && <span className="meta-tag">{communityOutfit.occasion}</span>}
                  {communityOutfit.season && <span className="meta-tag">{communityOutfit.season}</span>}
                </div>
                {communityOutfit.cohesion_score != null && (
                  <span className="compare-modal-score">{communityOutfit.cohesion_score}/10</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="compare-modal-divider">
            <span>VS</span>
          </div>

          {/* ── My Outfit (Right) ── */}
          <div className="compare-modal-slot">
            <div className="compare-modal-slot-header">
              <span className="compare-modal-label">Yours</span>
            </div>
            <select
              className="compare-modal-select"
              value={selectedOutfitId || ''}
              onChange={(e) => setSelectedOutfitId(e.target.value || null)}
            >
              <option value="">Select your outfit...</option>
              {outfits.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            {selectedOutfit ? (
              <div className="compare-modal-card">
                <h4 className="compare-modal-name">{selectedOutfit.name}</h4>
                <div className="compare-modal-items">
                  {myItems.map((item) => (
                    <div key={item.id} className="compare-modal-item">
                      <img src={item.image} alt={item.name} loading="lazy" referrerPolicy="no-referrer" />
                      <span className="compare-modal-item-name">{item.name}</span>
                    </div>
                  ))}
                </div>
                <div className="compare-modal-meta">
                  <div className="compare-modal-tags">
                    {selectedOutfit.style && <span className="meta-tag">{selectedOutfit.style}</span>}
                    {selectedOutfit.occasion && <span className="meta-tag">{selectedOutfit.occasion}</span>}
                    {selectedOutfit.season && <span className="meta-tag">{selectedOutfit.season}</span>}
                  </div>
                  {selectedOutfit.cohesion_score != null && (
                    <span className="compare-modal-score">{selectedOutfit.cohesion_score}/10</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="compare-modal-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
                </svg>
                <p>Pick one of your outfits to compare</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

CompareModal.propTypes = {
  opened: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  feedItem: PropTypes.object,
  outfits: PropTypes.array.isRequired,
  wardrobeItems: PropTypes.array.isRequired,
};

export default memo(CompareModal);
