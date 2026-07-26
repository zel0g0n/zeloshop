import {FiClock, FiChevronRight} from "react-icons/fi";
const ActiveOrder = () => {
      const user = false

    const seeCurer = () => {
      const yandexTrackingUrl = "https://dostavka.yandex.ru/route/4aad6558-4330-4716-95b1-46fdbdb7f054";
      const width = 450;
      const height = 600;
      
      const left = window.screen.width - width - 50; // ekranning o'ng chetidan 50px ichkarida
      const top = 100;
  
      window.open(
        yandexTrackingUrl, 
        "YandexKuryer", // Oyna nomi
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    }
  return (
    <>
    {user > 0 && (
        <div onClick={seeCurer} className="block p-4 pb-0">
          <div className="bg-amber-50 border border-amber-200/30 rounded-[22px] p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                <FiClock size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">Buyurtmangiz yo'lda</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">Kuryer manzilingizga yaqinlashmoqda</p>
              </div>
            </div>
            <FiChevronRight size={16} className="text-amber-500" />
          </div>
        </div>
      )}
    </>

  )
}

export default ActiveOrder