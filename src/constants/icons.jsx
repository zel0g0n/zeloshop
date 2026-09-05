/**
 * IKKINCHI IKONKA KUTUBXONASINI OLIB TASHLASH (2026-09 audit,
 * "Dependency tozalash: icon kutubxonalar"): bu fayl oldin
 * `react-icons`ning 10 dan ortiq turli oilasidan (fa, fa6, fi, io,
 * io5, md, ai, go, bs, ci, fc, lu) 27 ta ikonka import/export qilardi
 * — lekin butun loyiha bo'ylab qidiruv shuni ko'rsatdiki, ular orasidan
 * FAQAT 14 tasi (pastdagi ro'yxat) haqiqatda biror joyda import
 * qilinar edi (`grep -rn "from ['\"]@/constants/icons['\"]" src/`),
 * qolgan ~13 tasi (FcWiFiLogo, FcPrevious, FcNext,
 * AiOutlineDollarCircle, MdOutlineNewReleases, AiFillStar,
 * MdLocalFireDepartment, BsGrid, IoHeart, IoBagHandleOutline,
 * FiUser/FiMapPin/FiPhoneCall/... va h.k.) — HECH QAYERDA
 * ishlatilmagan, o'lik eksport edi.
 *
 * Loyihaning O'Z INTERFEYSI ATAYLAB faqat `lucide-react`dan
 * foydalanadi (`aiImage.js`dagi izohga qarang — "faqat lucide-react
 * ikonkalar" qoidasi) — `react-icons` esa ikkinchi, parallel
 * kutubxona sifatida tasodifan kirib qolgan (turli fayllar turli
 * paytlarda turlicha tanlagan). Ikkita ikonka kutubxonasini saqlash:
 * (a) bir xil vizual tushunchani (masalan "orqaga" strelkasi) turli
 * fayllarda turlicha chizadi — nomuvofiq UI, (b) yangi kod yozganda
 * "qaysi kutubxonadan foydalanish kerak" degan keraksiz qarorni
 * talab qiladi. Shuning uchun: FAQAT haqiqatda ishlatilayotgan
 * ikonkalar, `lucide-react`ning ekvivalent nomlariga o'tkazilib,
 * SHU NOM bilan qayta eksport qilindi — bu orqali barcha 8 ta
 * chaqiruvchi fayl HECH QANDAY o'zgarishsiz ishlayveradi (faqat
 * ikonka manbasi almashtirildi, import nomlari saqlanib qolindi).
 */
import {
  Home,
  TextSearch,
  ShoppingBag,
  CircleUserRound,
  Heart,
  ArrowLeft,
  SlidersHorizontal,
  Search,
  Trash2,
  Minus,
  Plus,
  CirclePlus,
  Settings,
  List,
} from "lucide-react";

export {
  Home as GoHome,
  TextSearch as LuTextSearch,
  ShoppingBag as MdOutlineShoppingBag,
  CircleUserRound as FaRegCircleUser,
  Heart as FaRegHeart,
  ArrowLeft as IoArrowBack,
  SlidersHorizontal as FiSliders,
  Search as IoIosSearch,
  Trash2 as IoTrashOutline,
  Minus as AiOutlineMinus,
  Plus as AiOutlinePlus,
  CirclePlus as GoPlusCircle,
  Settings as IoSettingsOutline,
  List as FaList,
};
