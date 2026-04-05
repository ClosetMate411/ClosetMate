import React, { memo } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import FloatingEmojiBg from "../FloatingEmojiBg/FloatingEmojiBg";
import "./EmptyWardrobe.css";

const EmptyWardrobe = ({ onAddClick, userName }) => (
  <div className="ew-root">
    <FloatingEmojiBg />
    {/* ── Ambient blobs ── */}
    <div className="ew-blob ew-blob--1" aria-hidden />
    <div className="ew-blob ew-blob--2" aria-hidden />
    <div className="ew-blob ew-blob--3" aria-hidden />

    {/* ── Hero ── */}
    <motion.div
      className="ew-hero-content"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="ew-headline">
        <span className="ew-headline-accent">{userName}</span>
        {", your wardrobe awaits"}
      </h1>
      <p className="ew-sub">
        Build your personal style, one outfit at a time ✨
      </p>
      <div className="ew-cta-group">
        <motion.button
          className="ew-cta"
          onClick={onAddClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="ew-cta-plus">+</span>
          Add Your First Item
        </motion.button>
        <p className="ew-cta-hint">Start with your favourite piece</p>
      </div>
    </motion.div>
  </div>
);

EmptyWardrobe.propTypes = {
  onAddClick: PropTypes.func.isRequired,
  userName:   PropTypes.string,
};

EmptyWardrobe.defaultProps = {
  userName: "Your",
};

export default memo(EmptyWardrobe);
