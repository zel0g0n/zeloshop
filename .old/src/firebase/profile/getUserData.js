import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiUser, FiPhone, FiAtSign, FiCheckCircle, FiCamera } from 'react-icons/fi'; 
import { useUploadImage } from '@/hooks/storage/useUploadStorage';
import useUpdateClientData from '@/hooks/useUpdateClientData';


const ProfileEditPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Redux state
  const clientInfo = useSelector(state => state.profile?.clientInfo);
  const currentUserId = useSelector(state => state.auth?.user?.uid);

  // 1. DUPLICATE STATE NOMINI CHALIKASHLIKSIZ HAL QILISH (Aliasing)
  const { 
    updateClient, 
    loading: isUpdating, 
    success, 
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

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    username: ''
  });

  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  // Ma'lumotlarni initsializatsiya qilish
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

  // Muvaffaqiyatli saqlangandan keyin orqaga qaytish
  useEffect(() => {
    if (isSaved) {
      const timer = setTimeout(() => {
        navigate(-1); 
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSaved, navigate]);

  // 2. VAQTINCHALIK URL XOTIRASINI TOZALASH (Garbage Collection)
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Agar eski vaqtinchalik preview URL mavjud bo'lsa, xotirani bo'shatamiz
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      
      setImagePreview(URL.createObjectURL(file));
    }
  }, [imagePreview]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSaveChanges = useCallback(async (e) => {
    e.preventDefault();

    const nameTrimmed = formData.name.trim();
    const phoneTrimmed = formData.phone.trim();
    const usernameTrimmed = formData.username.trim();

    if (!nameTrimmed || !phoneTrimmed) {
      setUploadError("Ism va telefon raqam maydonlarini to'ldirish shart!");
      return;
    }

    // Foydalanuvchi tizimga kirmagan bo'lsa, davom ettirmaymiz
    if (!currentUserId) {
      setUploadError("Foydalanuvchi aniqlanmadi. Tizimga qaytadan kiring.");
      return;
    }

    try {
      let finalAvatarUrl = clientInfo?.avatar || '';

      if (selectedFile) {
        // Rasm yuklash (siqish hook ichida bajariladi)
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

      console.log("Bazaga yuborilayotgan ma'lumot:", updateData);
      
      // Firestore yoki API orqali yangilash
      await updateClient(currentUserId, updateData);
      
      setIsSaved(true);
    } catch (err) {
      console.error("Saqlash jarayonida xatolik:", err);
    }
  }, [formData, selectedFile, uploadImage, currentUserId, clientInfo, setUploadError, updateClient]);

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

  const handleBack = useCallback(() => {
    cancelUpload();
    // Xotiradagi blob-ni tozalash
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    window.history.length > 1 ? navigate(-1) : navigate('/');
  }, [navigate, cancelUpload, imagePreview]);


  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 pt-4 relative select-none">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center justify-between">
        <button 
          type="button"
          onClick={handleBack} 
          className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          <FiArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] flex-1 text-center mr-10">Profilni tahrirlash</h1>
      </div>

      <div className="max-w-md mx-auto px-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100/80 space-y-6">
          
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative group">
              <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-blue-500/20 overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer border-2 border-white"
              >
                <FiCamera size={14} />
              </button>
            </div>
            
            <p className="text-xs text-gray-400 mt-3">Profil rasmini o'zgartirish uchun kamerani bosing</p>
            {loading && <p className="text-xs text-blue-500 mt-1 font-semibold">Siqilmoqda va yuklanmoqda: {progress}%</p>}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          <form onSubmit={handleSaveChanges} className="space-y-5">
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 pl-1 uppercase tracking-wider">To'liq ism</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiUser size={16} />
                </span>
                <input 
                  type="text" 
                  name="name"
                  required
                  value={formData.name} 
                  onChange={handleInputChange}
                  placeholder="Max Tiger" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 font-medium placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 pl-1 uppercase tracking-wider">Telefon raqam</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiPhone size={16} />
                </span>
                <input 
                  type="tel" 
                  name="phone"
                  required  
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+998 90 123 45 67" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 font-medium placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 pl-1 uppercase tracking-wider">Telegram Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiAtSign size={16} />
                </span>
                <input 
                  type="text" 
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="max_tiger" 
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 font-medium placeholder-gray-400"
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={loading || isSaved}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-center text-sm shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none cursor-pointer"
              >
                {loading ? "Rasm yuklanmoqda..." : "O'zgarishlarni saqlash"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isSaved && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-xl flex flex-col items-center max-w-xs text-center">
            <FiCheckCircle size={44} className="text-green-500 mb-3" />
            <h3 className="text-base font-bold text-gray-800 mb-1">Muvaffaqiyatli saqlandi!</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditPage;
