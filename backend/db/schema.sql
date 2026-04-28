--
-- PostgreSQL database dump
--

\restrict c2M7BdurNyUcR1nRLChJUMc8G5rEwTVBJxqNdwqana9XS28NDWCryGdXb7XGzmB

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clothing_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clothing_attributes (
    id character varying NOT NULL,
    item_id character varying NOT NULL,
    user_id character varying NOT NULL,
    category character varying(50) NOT NULL,
    subcategory character varying(50) NOT NULL,
    color_primary character varying(30) NOT NULL,
    color_secondary character varying(30),
    pattern character varying(30),
    material character varying(30),
    style character varying(30),
    fit character varying(30),
    formality_level integer,
    weather_suitability json,
    suitable_occasions json,
    description text,
    analyzed_at timestamp without time zone,
    analysis_version character varying(20),
    name character varying(60),
    seasons json DEFAULT '[]'::json
);


--
-- Name: clothing_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clothing_items (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    item_name character varying(255),
    season character varying(50),
    image_url character varying NOT NULL,
    file_name character varying(255),
    file_size integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id character varying NOT NULL,
    shared_outfit_id character varying NOT NULL,
    user_id character varying NOT NULL,
    text text NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: community_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_favorites (
    id character varying NOT NULL,
    shared_outfit_id character varying NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: moderation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderation_logs (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    action_type character varying(20) NOT NULL,
    content_preview character varying(200),
    internal_reason character varying(500),
    severity character varying(10),
    detection_layer character varying(20),
    strike_number integer NOT NULL,
    punishment character varying(50) NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id character varying NOT NULL,
    recipient_user_id character varying NOT NULL,
    actor_user_id character varying NOT NULL,
    shared_outfit_id character varying NOT NULL,
    type character varying(20) NOT NULL,
    detail character varying(50),
    is_read boolean,
    created_at timestamp without time zone
);


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id character varying NOT NULL,
    email character varying(254) NOT NULL,
    code character varying(6) NOT NULL,
    purpose character varying(20) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone,
    used boolean,
    failed_attempts integer DEFAULT 0
);


--
-- Name: outfit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outfit_items (
    id character varying NOT NULL,
    outfit_id character varying NOT NULL,
    item_id character varying NOT NULL,
    "position" integer
);


--
-- Name: outfits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outfits (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    name character varying(100) NOT NULL,
    style character varying(30),
    occasion character varying(30),
    season character varying(20),
    cohesion_score integer,
    reasoning text,
    is_favorite boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    is_shareable boolean DEFAULT false
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone,
    used boolean
);


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ratings (
    id character varying NOT NULL,
    shared_outfit_id character varying NOT NULL,
    user_id character varying NOT NULL,
    score integer NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reactions (
    id character varying NOT NULL,
    shared_outfit_id character varying NOT NULL,
    user_id character varying NOT NULL,
    emoji_type character varying(20) NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id character varying NOT NULL,
    user_id character varying NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone,
    revoked_at timestamp without time zone,
    replaced_by character varying(64),
    user_agent character varying(255)
);


--
-- Name: shared_outfits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_outfits (
    id character varying NOT NULL,
    outfit_id character varying NOT NULL,
    user_id character varying NOT NULL,
    description text,
    shared_at timestamp without time zone,
    outfit_snapshot text,
    item_snapshot text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    email character varying(254) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    created_at timestamp without time zone,
    last_login timestamp without time zone,
    failed_login_attempts integer,
    lockout_until timestamp without time zone,
    is_verified boolean,
    avatar_url character varying(500) DEFAULT NULL::character varying,
    comment_strike_count integer DEFAULT 0,
    comment_banned_until timestamp without time zone,
    comment_ban_permanent boolean DEFAULT false,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL
);


--
-- Name: clothing_attributes clothing_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clothing_attributes
    ADD CONSTRAINT clothing_attributes_pkey PRIMARY KEY (id);


--
-- Name: clothing_items clothing_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clothing_items
    ADD CONSTRAINT clothing_items_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: community_favorites community_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_favorites
    ADD CONSTRAINT community_favorites_pkey PRIMARY KEY (id);


--
-- Name: moderation_logs moderation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderation_logs
    ADD CONSTRAINT moderation_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: outfit_items outfit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_items
    ADD CONSTRAINT outfit_items_pkey PRIMARY KEY (id);


--
-- Name: outfits outfits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfits
    ADD CONSTRAINT outfits_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: reactions reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: shared_outfits shared_outfits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_outfits
    ADD CONSTRAINT shared_outfits_pkey PRIMARY KEY (id);


--
-- Name: community_favorites uq_favorite_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_favorites
    ADD CONSTRAINT uq_favorite_user UNIQUE (shared_outfit_id, user_id);


--
-- Name: ratings uq_rating_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT uq_rating_user UNIQUE (shared_outfit_id, user_id);


--
-- Name: reactions uq_reaction_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reactions
    ADD CONSTRAINT uq_reaction_user UNIQUE (shared_outfit_id, user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_clothing_items_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clothing_items_created ON public.clothing_items USING btree (user_id, created_at DESC);


--
-- Name: ix_clothing_attributes_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_clothing_attributes_item_id ON public.clothing_attributes USING btree (item_id);


--
-- Name: ix_clothing_attributes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clothing_attributes_user_id ON public.clothing_attributes USING btree (user_id);


--
-- Name: ix_clothing_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_clothing_items_user_id ON public.clothing_items USING btree (user_id);


--
-- Name: ix_comments_shared_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_comments_shared_outfit_id ON public.comments USING btree (shared_outfit_id);


--
-- Name: ix_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_comments_user_id ON public.comments USING btree (user_id);


--
-- Name: ix_community_favorites_shared_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_community_favorites_shared_outfit_id ON public.community_favorites USING btree (shared_outfit_id);


--
-- Name: ix_community_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_community_favorites_user_id ON public.community_favorites USING btree (user_id);


--
-- Name: ix_moderation_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_moderation_logs_user_id ON public.moderation_logs USING btree (user_id);


--
-- Name: ix_notifications_recipient_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_recipient_user_id ON public.notifications USING btree (recipient_user_id);


--
-- Name: ix_otp_codes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_otp_codes_email ON public.otp_codes USING btree (email);


--
-- Name: ix_otp_email_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_otp_email_purpose ON public.otp_codes USING btree (email, purpose);


--
-- Name: ix_outfit_items_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outfit_items_item_id ON public.outfit_items USING btree (item_id);


--
-- Name: ix_outfit_items_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outfit_items_outfit_id ON public.outfit_items USING btree (outfit_id);


--
-- Name: ix_outfits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outfits_user_id ON public.outfits USING btree (user_id);


--
-- Name: ix_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: ix_ratings_shared_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ratings_shared_outfit_id ON public.ratings USING btree (shared_outfit_id);


--
-- Name: ix_ratings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ratings_user_id ON public.ratings USING btree (user_id);


--
-- Name: ix_reactions_shared_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reactions_shared_outfit_id ON public.reactions USING btree (shared_outfit_id);


--
-- Name: ix_reactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reactions_user_id ON public.reactions USING btree (user_id);


--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_shared_outfits_outfit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shared_outfits_outfit_id ON public.shared_outfits USING btree (outfit_id);


--
-- Name: ix_shared_outfits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_shared_outfits_user_id ON public.shared_outfits USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: clothing_items clothing_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clothing_items
    ADD CONSTRAINT clothing_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: clothing_attributes fk_clothing_attributes_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clothing_attributes
    ADD CONSTRAINT fk_clothing_attributes_item FOREIGN KEY (item_id) REFERENCES public.clothing_items(id) ON DELETE CASCADE;


--
-- Name: outfit_items fk_outfit_items_clothing_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_items
    ADD CONSTRAINT fk_outfit_items_clothing_item FOREIGN KEY (item_id) REFERENCES public.clothing_items(id) ON DELETE CASCADE;


--
-- Name: outfit_items outfit_items_outfit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outfit_items
    ADD CONSTRAINT outfit_items_outfit_id_fkey FOREIGN KEY (outfit_id) REFERENCES public.outfits(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict c2M7BdurNyUcR1nRLChJUMc8G5rEwTVBJxqNdwqana9XS28NDWCryGdXb7XGzmB

