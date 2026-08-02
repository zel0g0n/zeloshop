import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiUser, FiPhone, FiAtSign, FiCamera } from 'react-icons/fi'; 
import { useUploadImage } from '@/hooks/storage/useUploadStorage';
import useUpdateClientData from '@/hooks/useUpdateClientData';
import { useSession } from '@/context/SessionContext';
import { formatUzPhone, isValidUzPhone } from '@/utils/phone';
import StatusModal from '@/components/ui/StatusModal';

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Redux-dan ma'lumotlarni olish
  const clientInfo = useSelector(state => state.profile?.clientInfo);
  const { clientId: currentUserId } = useSession();

  // Bazani yangilash hooki (Unga tegishli holatlarni qayta nomlaymiz)
  const { 
    updateClient, 
    loading: isUpdating, 
    success: isUpdateSuccess, 
    error: updateError, 
    clearStatus 
  } = useUpdateClientData();

  const { 
    uploadImage, 
    progress: uploadProgress, 
    loading: isUploading, 
    error: uploadError, 
    setError: setUploadError,
    cancelUpload 
  } = useUploadImage();

  const [formData, setFormData] = useState(() => ({
    name: clientInfo?.name || '',
    phone: clientInfo?.phone || '', 
    username: clientInfo?.username ? clientInfo.username.replace('@', '') : ''
  }));

  const [imagePreview, setImagePreview] = useState(() => clientInfo?.avatar || null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (clientInfo && !isInitializedRef.current) {
      setFormData({
        name: clientInfo.name || '',
        phone: clientInfo.phone || '', 
        username: clientInfo.username ? clientInfo.username.replace('@', '') : ''
      });
      if (clientInfo.avatar) {
        setImagePreview(clientInfo.avatar);
      }
      isInitializedRef.current = true;
    }
  }, [clientInfo]);

  // Muvaffaqiyatli saqlangandan keyin orqaga qaytish taymeri
  useEffect(() => {
    if (isSaved) {
      const timer = setTimeout(() => {
        navigate(-1); 
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSaved, navigate]);

  // Rasm tanlanganda uni xotirada preview qilish
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Agar eski yaratilgan blob URL bo'lsa, xotirani bo'shatamiz (Memory leak profilaktikasi)
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
    }
  }, [imagePreview]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatUzPhone(value) }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  // Ma'lumotlarni saqlash mantiqi
  const handleSaveChanges = useCallback(async (e) => {
    e.preventDefault();
    
    // Har qanday eski xatoliklarni tozalab olamiz
    if (clearStatus) clearStatus();
    setUploadError(null);

    const nameTrimmed = formData.name.trim();
    const phoneTrimmed = formData.phone.trim();
    const usernameTrimmed = formData.username.trim();

    if (!nameTrimmed || !phoneTrimmed) {
      setUploadError("Ism va telefon raqam maydonlarini to'ldirish shart!");
      return;
    }

    if (!isValidUzPhone(phoneTrimmed)) {
      setUploadError("Iltimos, to'liq telefon raqam kiriting (masalan: +998 90 123 45 67).");
      return;
    }

    if (!currentUserId) {
      setUploadError("Foydalanuvchi aniqlanmadi. Tizimga qaytadan kiring.");
      return;
    }

    try {
      let finalAvatarUrl = clientInfo?.avatar || '';

      // Agar yangi rasm tanlangan bo'lsa, avval uni yuklaymiz
      if (selectedFile) {
        finalAvatarUrl = await uploadImage(selectedFile, `avatars/${currentUserId}`);
      }

      const formattedUsername = usernameTrimmed 
        ? (usernameTrimmed.startsWith('@') ? usernameTrimmed : `@${usernameTrimmed}`)
        : '';

      const updateData = {
        name: nameTrimmed,
        phone: phoneTrimmed, 
        username: formattedUsername,
        avatar: finalAvatarUrl
      };

      
      // Firestore/Backend-ni yangilash
      await updateClient(currentUserId, updateData);
      setIsSaved(true);
    } catch (err) {
      console.error("Saqlash jarayonida xatolik:", err);
    }
  }, [formData, selectedFile, uploadImage, currentUserId, clientInfo, setUploadError, updateClient, clearStatus]);

  // Ismning bosh harflarini generatsiya qilish
  const avatarInitials = useMemo(() => {
    if (!formData.name) return 'MT';
    return formData.name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, [formData.name]);

  // Orqaga qaytish va barcha jarayonlarni tozalash
  const handleBack = useCallback(() => {
    cancelUpload();
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    // Xavfsiz orqaga qaytish mantiqi
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate, cancelUpload, imagePreview]);

  // Umumiy yuklash/ishlash holatlari
  const isAnyLoading = isUploading || isUpdating;
  const anyError = uploadError || updateError;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-12 pt-4 relative select-none transition-colors duration-300">
      {/* HEADER */}
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center justify-between">
        <button 
          type="button"
          onClick={handleBack} 
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <FiArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white flex-1 text-center mr-10">Profilni tahrirlash</h1>
      </div>

      <div className="max-w-md mx-auto px-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800 space-y-6">
          
          {/* AVATAR RENDER & UPLOAD */}
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative group">
              <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-blue-500/20 overflow-hidden relative">
                {imagePreview ? (
                  <img src={imagePreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  avatarInitials
                )}

                {/* Yuklanish progress overlay'i */}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold">
                    <span>{uploadProgress}%</span>
                    <button 
                      type="button" 
                      onClick={cancelUpload}
                      className="text-[10px] text-red-300 underline mt-1"
                    >
                      Bekor qilish
                    </button>
                  </div>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              
              {!isUploading && (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer border-2 border-white dark:border-slate-900 hover:bg-blue-700"
                >
                  <FiCamera size={14} />
                </button>
              )}
            </div>
            
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">Profil rasmini o'zgartirish uchun kamerani bosing</p>
            {isUploading && <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 font-semibold">Siqilmoqda va yuklanmoqda...</p>}
            {anyError && <p className="text-xs text-red-500 mt-1 text-center font-medium bg-red-50 dark:bg-red-500/10 px-3 py-1 rounded-full">{anyError}</p>}
          </div>

          {/* INPUT FORM */}
          <form onSubmit={handleSaveChanges} className="space-y-5">
            {/* TO'LIQ ISM */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1.5 pl-1 uppercase tracking-wider">To'liq ism</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                  <FiUser size={16} />
                </span>
                <input 
                  type="text" 
                  name="name"
                  required
                  value={formData.name} 
                  onChange={handleInputChange}
                  placeholder="Max Tiger" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white font-medium placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>
            </div>

            {/* TELEFON */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1.5 pl-1 uppercase tracking-wider">Telefon raqam</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                  <FiPhone size={16} />
                </span>
                <input 
                  type="tel" 
                  inputMode="numeric"
                  name="phone"
                  required  
                  value={formData.phone}
                  onFocus={() => { if (!formData.phone) setFormData(prev => ({ ...prev, phone: '+998 ' })); }}
                  onChange={handleInputChange}
                  placeholder="+998 90 123 45 67" 
                  maxLength={17}
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white font-medium placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>
            </div>

            {/* TELEGRAM USERNAME */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1.5 pl-1 uppercase tracking-wider">Telegram Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                  <FiAtSign size={16} />
                </span>
                <input 
                  type="text" 
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="max_tiger" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white font-medium placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>
            </div>

            {/* SUBMIT TUGMASI */}
            <div className="pt-4">
              <button 
                type="submit"
                disabled={isAnyLoading || isSaved}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-center text-sm shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none cursor-pointer"
              >
                {isAnyLoading ? "Ma'lumotlar saqlanmoqda..." : "O'zgarishlarni saqlash"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MUVAFFAQIYATLI SAQLANDI MODAL */}
      {isSaved && (
        <StatusModal
          variant="success"
          title="Muvaffaqiyatli saqlandi!"
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default ProfileEditPage;