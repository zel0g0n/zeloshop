import { MdOutlineModeEditOutline } from "react-icons/md";
import useGetClientData from "@/hooks/useGetClientData";
import { useNavigate } from "react-router";
const CabinetHeader = () => {
  const { clientInfo, loading, error } = useGetClientData();
  const navigate = useNavigate();
  
  if (loading) return <div className="p-6 text-center text-gray-500">Yuklanmoqda...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Xatolik: {error}</div>;
  if (!clientInfo) return null;

  const getInitials = (name) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase() : "?";

  return (
    <div className="flex justify-between items-center bg-white rounded-b-[32px] p-6 pt-8 border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-[22px] bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-600/10 shrink-0 relative">
          {clientInfo.avatar ? (
            <img src={clientInfo.avatar} alt={clientInfo.name} className="w-full h-full object-cover rounded-[22px]" />
          ) : (
            getInitials(clientInfo.name)
          )}
        </div>
        
        <div>
          <h2 className="text-lg font-black text-gray-800 leading-tight tracking-tight">
            {clientInfo.name || "Ismsiz foydalanuvchi"}
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {clientInfo.username || "Foydalanuvchi nomi kiritilmagan"}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {clientInfo.phone || "Telefon kiritilmagan"}
          </p>
        </div>
      </div>
      
      <div onClick={() => navigate('/cabinet/edit')} className="border border-blue-500/50 rounded-[10px] px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors">
        <span className="text-[20px] text-blue-500"><MdOutlineModeEditOutline /></span>
      </div>
    </div>
  );
};

export default CabinetHeader;
