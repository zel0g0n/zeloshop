import { memo } from "react";
import { MdOutlineModeEditOutline } from "react-icons/md";
import useGetClientData from "@/hooks/useGetClientData";
import { useNavigate } from "react-router";
import { ProfileHeaderSkeleton } from "@/components/ui/Skeleton";

const getInitials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase() : "?";

const CabinetHeader = () => {
  const { clientInfo, loading, error } = useGetClientData();
  const navigate = useNavigate();
  
  if (loading) return <ProfileHeaderSkeleton />;
  if (error) return <div className="p-6 text-center text-red-500">Xatolik: {error}</div>;
  if (!clientInfo) return null;

  return (
    <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-b-[32px] p-6 pt-8 border-b border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[22px] bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-600/10 shrink-0 relative">
          {clientInfo.avatar ? (
            <img src={clientInfo.avatar} alt={clientInfo.name} className="w-full h-full object-cover rounded-[22px]" />
          ) : (
            getInitials(clientInfo.name)
          )}
        </div>
        
        <div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white leading-tight tracking-tight">
            {clientInfo.name || "Ismsiz foydalanuvchi"}
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 font-medium mt-1">
            {clientInfo.username || "Foydalanuvchi nomi kiritilmagan"}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-400 font-medium mt-1">
            {clientInfo.phone || "Telefon kiritilmagan"}
          </p>
        </div>
      </div>
      
      <div onClick={() => navigate('/cabinet/edit')} className="border border-blue-500/50 rounded-[10px] px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
        <span className="text-[20px] text-blue-500"><MdOutlineModeEditOutline /></span>
      </div>
    </div>
  );
};

export default memo(CabinetHeader);
