/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div id="auth-container" className="min-h-screen w-full flex flex-col md:flex-row bg-[#0b1329]">
      {/* Left Branding Panel */}
      <div 
        id="branding-sidebar" 
        className="w-full md:w-[45%] lg:w-[48%] bg-[#080f21] px-5 py-5 md:p-14 xl:p-16 flex flex-col justify-between border-r border-[#1a2c54]/20 relative overflow-hidden shrink-0"
      >
        {/* Abstract background graphics for elevated premium mood */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,58,138,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo Section */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          id="brand-logo-container" 
          className="flex items-center gap-4 relative z-10"
        >
          <div 
            id="logo-icon-card" 
            className="w-10 h-10 md:w-12 md:h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-md"
          >
            <GraduationCap id="cap-icon" className="w-6 h-6 text-indigo-300" />
          </div>
          <div id="brand-text-section" className="flex flex-col text-left">
            <span id="brand-title" className="text-white font-extrabold text-lg tracking-wider font-sans leading-none">FSKTM</span>
            <span id="brand-subtitle" className="text-slate-400 text-[10px] font-semibold tracking-[0.2em] mt-1 leading-snug">
              POSTGRADUATE<br />OFFICE
            </span>
          </div>
        </motion.div>

        {/* Welcome message in the center block (kept short on phones so the form is in view) */}
        <div id="welcome-message-block" className="mt-4 md:my-auto relative z-10 max-w-lg text-left">
          <motion.div 
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hidden md:flex items-center gap-2 mb-4"
          >
            <div className="w-8 h-[1px] bg-indigo-400" />
            <span id="welcome-eyebrow" className="text-xs uppercase font-extrabold tracking-[0.25em] text-indigo-300">
              Welcome To
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            id="welcome-title" 
            className="text-white text-xl md:text-3xl lg:text-4xl xl:text-[44px] font-extrabold tracking-tight leading-[1.12]"
          >
            Postgraduate Management System
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            id="welcome-description" 
            className="hidden md:block text-slate-400 text-sm lg:text-base mt-6 leading-relaxed font-normal"
          >
            A centralized, secure platform engineered for academic administrators and students. 
            Manage records, automate document workflows, and access institutional resources efficiently.
          </motion.p>
        </div>

        {/* Left Side Column Footer */}
        <div id="left-footer" className="mt-8 pt-4 hidden md:flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] text-slate-500 font-medium relative z-10 gap-2 text-left">
          <span id="copyright-text">© 2026 FACULTY OF COMPUTER SCIENCE AND INFORMATION TECHNOLOGY (FSKTM)</span>
          <div id="footer-links" className="flex items-center gap-4">
            <a href="#" className="hover:text-indigo-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-300 transition-colors">Terms</a>
          </div>
        </div>
      </div>

      {/* Right Form Pane */}
      <div 
        id="login-form-pane" 
        className="w-full md:w-[55%] lg:w-[52%] flex-1 bg-[#f8fafc] flex flex-col justify-start md:justify-center items-center px-4 pt-12 pb-10 sm:px-6 md:p-10 xl:p-14 relative"
      >
        {children}
      </div>
    </div>
  );
};
