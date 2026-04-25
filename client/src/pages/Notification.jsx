import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Shield, CheckCircle, Mail, Sparkles, 
  Crown, Award, Star, Zap, Gift, Heart, ThumbsUp,
  UserCheck, FileCheck, BadgeCheck, Verified,
  Calendar, Bell, MessageCircle, Headphones,
  ArrowRight, Home, HelpCircle, Send, Loader2
} from 'lucide-react';

const Notification = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center p-4">
      
      {/* Premium Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        
        {/* Hero Header with Gradient */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 p-8 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -ml-12 -mb-12" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          
          <div className="relative z-10 text-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="relative inline-block"
            >
              <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Shield size="36" className="text-white" />
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full p-1.5 shadow-lg"
              >
                <Clock size="14" className="text-white" />
              </motion.div>
            </motion.div>
            
            <h1 className="text-2xl font-bold mt-4">Verification in Progress</h1>
            <p className="text-orange-100 text-sm mt-1">Please wait while we verify your details</p>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8">
          
          {/* Animated Progress Indicator */}
          <div className="mb-8">
            <div className="relative mb-3">
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "75%" }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-2.5 rounded-full"
                />
              </div>
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 bg-orange-500 rounded-full shadow-md"
                />
              </div>
            </div>
            
            <div className="flex justify-between text-xs font-medium">
              <div className="text-center flex-1">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm">
                  <CheckCircle size="12" className="text-white" />
                </div>
                <span className="text-gray-600">Submitted</span>
              </div>
              <div className="text-center flex-1">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-1 shadow-md"
                >
                  <Loader2 size="12" className="text-white animate-spin" />
                </motion.div>
                <span className="text-orange-600 font-semibold">Reviewing</span>
              </div>
              <div className="text-center flex-1">
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Shield size="10" className="text-gray-400" />
                </div>
                <span className="text-gray-400">Completed</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="text-center mb-6">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.3 }}
              className="relative inline-block mb-5"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center shadow-lg">
                <Mail size="40" className="text-orange-500" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full p-2 shadow-md">
                <Sparkles size="14" className="text-white" />
              </div>
            </motion.div>

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              We're Reviewing Your Profile
            </h2>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
              Thank you for submitting your profile! Our team is carefully reviewing 
              your information to ensure everything meets our standards.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { icon: Shield, label: 'Security Check', color: 'blue' },
                { icon: FileCheck, label: 'Document Review', color: 'green' },
                { icon: Clock, label: 'Final Approval', color: 'orange' },
              ].map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className={`bg-${item.color}-50 rounded-xl p-2.5 text-center border border-${item.color}-100`}
                >
                  <item.icon size="16" className={`text-${item.color}-500 mx-auto mb-1`} />
                  <p className="text-[10px] font-semibold text-gray-700">{item.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Timeline Card */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 mb-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <CheckCircle size="14" className="text-emerald-600" />
                  </div>
                  <p className="text-[11px] font-medium text-gray-600">Submitted</p>
                  <p className="text-[10px] text-gray-400">Jan 15, 2024</p>
                </div>
                <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-400 to-orange-400 mx-1" />
                <div className="text-center flex-1">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-8 h-8 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-1 shadow-md"
                  >
                    <Loader2 size="14" className="text-white animate-spin" />
                  </motion.div>
                  <p className="text-[11px] font-semibold text-orange-600">Reviewing</p>
                  <p className="text-[10px] text-gray-400">In Progress</p>
                </div>
                <div className="flex-1 h-0.5 bg-gray-200 mx-1" />
                <div className="text-center flex-1">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
                    <BadgeCheck size="14" className="text-gray-400" />
                  </div>
                  <p className="text-[11px] font-medium text-gray-400">Completed</p>
                  <p className="text-[10px] text-gray-400">Soon</p>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-3"
            >
              <div className="flex items-start gap-2">
                <div className="p-1 bg-yellow-100 rounded-lg flex-shrink-0">
                  <Clock size="14" className="text-yellow-600" />
                </div>
                <p className="text-xs text-yellow-800 text-left">
                  You'll receive a notification within <span className="font-bold">24 hours</span> once the verification is complete.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link 
              to="/" 
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transform transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <Home size="16" className="group-hover:scale-110 transition-transform" />
              Go to Homepage
              <ArrowRight size="14" className="group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <button className="w-full border-2 border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-orange-200 transition-all duration-200 flex items-center justify-center gap-2 group">
              <Headphones size="14" className="text-gray-400 group-hover:text-orange-500" />
              Contact Support
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
            <HelpCircle size="10" />
            Need help? 
            <a href="mailto:support@karigarconnect.com" className="text-orange-600 font-semibold hover:underline ml-1">
              Contact our support team
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Notification;