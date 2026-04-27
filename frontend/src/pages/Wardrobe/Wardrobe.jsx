import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClothingGrid,
  EmptyWardrobe,
  ClothingDropzone,
  ConfirmModal,
  Toast,
  LoadingScreen,
  ImageConfirmation,
} from "../../components";
import useWardrobeStore from "../../store/wardrobeStore";
import useAuthStore from "../../store/authStore";
import { useModal, useWardrobeHandlers, useToast } from "../../hooks";
import apiService from "../../services/api.service";
import ProcessingError from "./components/ProcessingError";
import ClothingDetail from "../../components/ClothingDetail/ClothingDetail";
import "./Wardrobe.css";

const selectItems = (state) => state.items;
const selectLoading = (state) => state.loading;
const selectOpenModal = (state) => state.openModal;
const selectSetOpenModal = (state) => state.setOpenModal;
const selectFetchItems = (state) => state.fetchItems;

const Wardrobe = () => {
  const items = useWardrobeStore(selectItems);
  const loading = useWardrobeStore(selectLoading);
  const openModal = useWardrobeStore(selectOpenModal);
  const setOpenModal = useWardrobeStore(selectSetOpenModal);
  const fetchItems = useWardrobeStore(selectFetchItems);
  const user = useAuthStore((s) => s.user);
  const displayName = user?.full_name || user?.name || "My";

  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [uploadState, setUploadState] = useState("idle");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const modal = useModal();
  const { toast, showSuccess, showError } = useToast();
  const handlers = useWardrobeHandlers(modal);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSelectedItem = useMemo(() => {
    if (!selectedItem) return null;
    const itemInStore = items.find((item) => item.id === selectedItem.id);
    return itemInStore ? { ...itemInStore, ...selectedItem } : selectedItem;
  }, [items, selectedItem]);

  const isLoading = useMemo(
    () =>
      loading ||
      ["processing", "saving", "analyzing", "updating", "deleting"].includes(uploadState),
    [loading, uploadState]
  );

  const handleFilesAccepted = useCallback(() => {}, []);

  const handleFilesRejected = useCallback(
    (rejections) => {
      const error = rejections[0]?.errors[0];
      if (error?.code === "file-too-large") showError("File is too large. Maximum size is 10MB.");
      else if (error?.code === "file-invalid-type") showError("Invalid file format. Please upload JPEG, PNG, or HEIC.");
      else showError("Failed to upload image. Please try another file.");
    },
    [showError]
  );

  // Gemini-verify an already-processed image URL. Returns true if it passed
  // moderation + bg-removal quality gates; false (and surfaces the right
  // user-facing error) otherwise.
  const verifyProcessedImage = useCallback(
    async (imageUrl) => {
      try {
        const res = await apiService.verifyImageQuality(imageUrl);
        const quality = res?.bg_removal_quality || res?.data?.bg_removal_quality;
        if (quality === "poor") {
          showError(
            "The background couldn't be cleanly removed — the cutout looks off. Try a cleaner, well-lit photo on a plain background."
          );
          return false;
        }
        return true;
      } catch (error) {
        const code = error?.response?.data?.error?.code;
        const message = error?.response?.data?.error?.message;
        if (code === "MODERATION_REJECTED") {
          showError(message || "This image wasn't recognized as a clothing item.");
          return false;
        }
        // Fail-open for transient errors — let the user proceed to confirm.
        return true;
      }
    },
    [showError]
  );

  const handleApplyUpload = useCallback(
    async (uploadedFiles) => {
      const file = uploadedFiles[0].file;
      setUploadedFile(file);
      setOpenModal(null);
      setUploadState("processing");
      setRetryCount(0);
      try {
        const result = await apiService.processImage(file);
        const imageUrl =
          result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;
        if (!imageUrl) throw new Error("No image URL in response");

        setUploadState("analyzing");
        const ok = await verifyProcessedImage(imageUrl);
        if (!ok) {
          setUploadedFile(null);
          setProcessedImageUrl(null);
          setUploadState("idle");
          return;
        }

        setProcessedImageUrl(imageUrl);
        setUploadState("confirming");
        showSuccess("Background has been successfully removed");
      } catch (error) {
        showError(error.message || "Failed to process image. Please try again.");
        setUploadState("error");
      }
    },
    [setOpenModal, showError, showSuccess, verifyProcessedImage]
  );

  const handleRetryProcessing = useCallback(async () => {
    if (!uploadedFile || retryCount >= 2) return;
    setUploadState("processing");
    setRetryCount((prev) => prev + 1);
    try {
      const result = await apiService.processImage(uploadedFile);
      const imageUrl =
        result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;

      setUploadState("analyzing");
      const ok = await verifyProcessedImage(imageUrl);
      if (!ok) {
        setUploadedFile(null);
        setProcessedImageUrl(null);
        setUploadState("idle");
        return;
      }

      setProcessedImageUrl(imageUrl);
      setUploadState("confirming");
      showSuccess("Background has been successfully removed");
    } catch (error) {
      showError(error.message || "Processing failed. Please try again.");
      setUploadState("error");
    }
  }, [uploadedFile, retryCount, showError, showSuccess, verifyProcessedImage]);

  const handleUploadDifferent = useCallback(() => {
    setUploadState("idle");
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
    setOpenModal("upload");
  }, [setOpenModal]);

  const handleCancelUpload = useCallback(() => {
    setUploadState("idle");
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
  }, []);

  const handleConfirmImage = useCallback(async () => {
    if (!uploadedFile) return;
    try {
      setUploadState("saving");
      const result = await handlers.handleApply(uploadedFile, "", "");
      const newItemId = result?.id;
      setUploadedFile(null);
      setProcessedImageUrl(null);
      if (newItemId) {
        setUploadState("analyzing");
        const { pollForAnalysis } = useWardrobeStore.getState();
        await pollForAnalysis(newItemId);
      }
      await useWardrobeStore.getState().fetchItems();
      setUploadState("idle");
      showSuccess("Item saved and analyzed!");
    } catch (error) {
      showError(error.message || "Failed to save item");
      setUploadState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFile, handlers]);

  const handleProcessEditImage = useCallback(
    async (file, tempEdits) => {
      if (!selectedItem) return;
      if (tempEdits) {
        setSelectedItem((prev) => ({ ...prev, name: tempEdits.name, weather: tempEdits.weather }));
      }
      setUploadState("processing");
      try {
        const result = await apiService.processImage(file);
        const imageUrl =
          result.data?.processed_url || result.processed_url || result.image_url || result.processed_image_url;
        if (!imageUrl) throw new Error("No image URL in response");
        setProcessedImageUrl(imageUrl);
        setUploadedFile(file);
        setUploadState("confirming");
        showSuccess("Background has been successfully removed");
      } catch (error) {
        showError(error.message || "Failed to process image.");
        setUploadState("error");
      }
    },
    [selectedItem, showError, showSuccess]
  );

  const handleConfirmAction = useCallback(async () => {
    const isEditMode = !!(selectedItem && selectedItem.id);
    if (isEditMode) {
      setSelectedItem((prev) => ({ ...prev, image: processedImageUrl, processedFile: uploadedFile }));
      setUploadState("idle");
      setIsEditingItem(true);
      setUploadedFile(null);
      setProcessedImageUrl(null);
    } else {
      await handleConfirmImage();
    }
  }, [selectedItem, processedImageUrl, uploadedFile, handleConfirmImage]);

  const handleCancelAction = useCallback(() => {
    setUploadState("idle");
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
  }, []);

  const handleUploadDifferentAction = useCallback(() => {
    const isEditMode = !!(selectedItem && selectedItem.id);
    setUploadState("idle");
    setUploadedFile(null);
    setProcessedImageUrl(null);
    setRetryCount(0);
    if (!isEditMode) setOpenModal("upload");
  }, [selectedItem, setOpenModal]);

  const handleSaveEdit = useCallback(
    async (itemId, updates) => {
      const currentItems = useWardrobeStore.getState().items;
      const originalItem = currentItems.find((i) => i.id === itemId);
      if (originalItem) {
        const nameChanged = (updates.itemName || "").trim() !== (originalItem.name || "").trim();
        const weatherChanged = (updates.weather || "").trim() !== (originalItem.weather || "").trim();
        const imageChanged = !!updates.file;
        if (!nameChanged && !weatherChanged && !imageChanged) { setIsEditingItem(false); return; }
      }
      try {
        setUploadState("updating");
        await handlers.handleSaveEdit(itemId, updates);
        await useWardrobeStore.getState().fetchItems();
        setUploadState("idle");
        showSuccess("Item updated successfully!");
      } catch (error) {
        showError(error.message || "Failed to update item");
        setUploadState("idle");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [handlers]
  );

  const handleCardClick = useCallback((item) => {
    setSelectedItem(item);
    setIsEditingItem(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setIsEditingItem(false);
  }, []);

  const handleDelete = useCallback(async () => {
    modal.openConfirmModal("delete", currentSelectedItem, async () => {
      try {
        setUploadState("deleting");
        await handlers.confirmDelete(currentSelectedItem.id);
        await fetchItems();
        setSelectedItem(null);
        setUploadState("idle");
        showSuccess("Item deleted successfully!");
      } catch (error) {
        showError(error.message || "Failed to delete item.");
        setUploadState("idle");
      }
    });
  }, [modal, currentSelectedItem, handlers, showSuccess, showError, fetchItems]);

  const handleAddClick = useCallback(() => setOpenModal("upload"), [setOpenModal]);
  const handleCloseUpload = useCallback(() => setOpenModal(null), [setOpenModal]);

  const getLoadingMessage = () => {
    if (uploadState === "processing") return "Removing background…";
    if (uploadState === "saving") return "Saving item…";
    if (uploadState === "analyzing") return "AI is analyzing…";
    if (uploadState === "updating") return "Saving changes…";
    if (uploadState === "deleting") return "Deleting item…";
    return "Loading wardrobe…";
  };

  const showDetailPanel =
    !!currentSelectedItem &&
    !isLoading &&
    uploadState !== "confirming" &&
    uploadState !== "error";

  return (
    <div className="wardrobe-page">
      {/* ── Dark purple header (hidden when empty) ── */}
      <div className={`wardrobe-topbar-wrap${items.length === 0 && !isLoading ? " wardrobe-topbar-wrap--hidden" : ""}`}>
        <motion.header
          className="wardrobe-topbar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="wardrobe-topbar-inner">
            <div className="wardrobe-topbar-left">
              <h1 className="wardrobe-topbar-title">
                <span className="wardrobe-topbar-name">{displayName}{"\u2019s"}</span>
                {" Wardrobe"}
              </h1>
              {items.length > 0 && (
                <span className="wardrobe-topbar-count">{items.length} piece{items.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            {items.length > 0 && (
              <motion.button
                className="wardrobe-topbar-add"
                onClick={handleAddClick}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <span className="wardrobe-add-plus">+</span>
                Add Item
              </motion.button>
            )}
          </div>
          {items.length > 0 && (
            <p className="wardrobe-topbar-hint">Click any item to view or edit it</p>
          )}
        </motion.header>
      </div>

      {/* ── Canvas ── */}
      <div className={`wardrobe-canvas${items.length === 0 && !isLoading ? " wardrobe-canvas--empty" : ""}`}>
        <AnimatePresence mode="wait">
          {items.length === 0 && !isLoading ? (
            <EmptyWardrobe key="empty" onAddClick={handleAddClick} userName={displayName} />
          ) : (
            <ClothingGrid key="grid" items={items} onCardClick={handleCardClick} />
          )}
        </AnimatePresence>

        {/* Canvas loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              className="canvas-loading-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingScreen message={getLoadingMessage()} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error overlay */}
        <AnimatePresence>
          {uploadState === "error" && (
            <ProcessingError
              retryCount={retryCount}
              onRetry={handleRetryProcessing}
              onUploadDifferent={handleUploadDifferent}
              onReturn={handleCancelUpload}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Image confirmation ── */}
      <AnimatePresence>
        {uploadState === "confirming" && processedImageUrl && (
          <ImageConfirmation
            imageUrl={processedImageUrl}
            onConfirm={handleConfirmAction}
            onUploadDifferent={handleUploadDifferentAction}
            onCancel={handleCancelAction}
            isEditMode={!!(selectedItem && selectedItem.id)}
          />
        )}
      </AnimatePresence>

      {/* ── Upload overlay ── */}
      <AnimatePresence>
        {openModal === "upload" && (
          <motion.div
            className="upload-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="upload-panel"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="upload-panel-header">
                <h2 className="upload-panel-title">Add to Wardrobe</h2>
                <button className="upload-panel-close" onClick={handleCloseUpload}>✕</button>
              </div>
              <div className="upload-panel-body">
                <ClothingDropzone
                  onFilesAccepted={handleFilesAccepted}
                  onFilesRejected={handleFilesRejected}
                  onApply={handleApplyUpload}
                  onCancel={handlers.handleCancel}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail modal ── */}
      <AnimatePresence>
        {showDetailPanel && (
          <motion.div
            className="detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleBack}
          >
            <motion.div
              className="detail-modal"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <ClothingDetail
                item={currentSelectedItem}
                onBack={handleBack}
                onDelete={handleDelete}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        opened={modal.isConfirmModalOpen}
        onClose={modal.closeConfirmModal}
        onConfirm={modal.handleConfirm}
        {...modal.confirmModalConfig}
      />
      <Toast {...toast} />
    </div>
  );
};

export default Wardrobe;
