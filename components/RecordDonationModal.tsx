import React, { useState, useRef } from 'react';
import { X, Calendar, Loader2, Droplet, Award, Upload, Download, Image as ImageIcon } from 'lucide-react';
import { Donor } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { logActivity } from '../services/logService';

interface RecordDonationModalProps {
  donor: Donor;
  onClose: () => void;
}

const RecordDonationModal: React.FC<RecordDonationModalProps> = ({ donor, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'generating' | 'result'>('form');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePoster = async (file: File, donorName: string, bloodGroup: string, dateStr: string, totalDonations: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1500; // Portrait mode matching the sample
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas not supported');

      // Colors (Matching the website's Tailwind theme)
      const COLOR_GREEN = '#059669'; // emerald-600
      const COLOR_RED = '#dc2626';   // red-600
      const COLOR_WHITE = '#FFFFFF';

      // Helper for Bengali numbers
      const toBengaliNumber = (num: number | string) => {
        const engToBng: { [key: string]: string } = {'0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯'};
        return num.toString().split('').map(c => engToBng[c] || c).join('');
      };

      const getBengaliOrdinal = (n: number) => {
        if (n === 1) return '১ম';
        if (n === 2) return '২য়';
        if (n === 3) return '৩য়';
        if (n === 4) return '৪র্থ';
        if (n === 5) return '৫ম';
        if (n === 6) return '৬ষ্ঠ';
        if (n === 7) return '৭ম';
        if (n === 8) return '৮ম';
        if (n === 9) return '৯ম';
        if (n === 10) return '১০ম';
        return toBengaliNumber(n) + ' তম';
      };

      // Determine Title
      let title = 'শুভেচ্ছা দূত';
      if (totalDonations >= 50) title = 'কিংবদন্তি দাতা';
      else if (totalDonations >= 30) title = 'মানবতার বাতিঘর';
      else if (totalDonations >= 20) title = 'রক্ত সৈনিক';
      else if (totalDonations >= 10) title = 'জীবন সারথি';
      else if (totalDonations >= 5) title = 'উৎসর্গকারী';

      // 1. Background (True White)
      ctx.fillStyle = COLOR_WHITE;
      ctx.fillRect(0, 0, 1080, 1500);

      // 2. Decorative Plus Circles (Light Green)
      const drawPlusCircle = (cx: number, cy: number, r: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#a7f3d0'; // emerald-200
        ctx.fill();
        ctx.fillStyle = COLOR_WHITE;
        ctx.font = `bold ${r * 1.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', cx, cy + r * 0.05);
      };
      drawPlusCircle(150, 350, 70);
      drawPlusCircle(850, 1400, 50);

      const formattedBloodGroup = bloodGroup.replace('+', ' +ve').replace('-', ' -ve');

      const drawContent = (logoImg?: HTMLImageElement) => {
        // 3. Texts (Top Right Aligned)
        const rightX = 1000;

        // Title Highlight (Attractive Gradient Pill Box)
        ctx.font = 'bold 55px sans-serif';
        const titleText = `★ ${title} ★`;
        const textWidth = ctx.measureText(titleText).width;
        const boxWidth = textWidth + 100;
        const boxHeight = 90;
        const boxX = rightX - boxWidth;
        const boxY = 120;

        const gradient = ctx.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY);
        gradient.addColorStop(0, '#F59E0B'); // amber-500
        gradient.addColorStop(1, '#EA580C'); // orange-600

        ctx.save();
        ctx.shadowColor = 'rgba(234, 88, 12, 0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 45);
        } else {
          ctx.rect(boxX, boxY, boxWidth, boxHeight);
        }
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = COLOR_WHITE;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(titleText, boxX + boxWidth / 2, boxY + boxHeight / 2 + 5);

        // Name (Green)
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COLOR_GREEN;
        let nameFontSize = 100;
        ctx.font = `900 ${nameFontSize}px sans-serif`;
        while (ctx.measureText(donorName).width > 800 && nameFontSize > 50) {
          nameFontSize -= 5;
          ctx.font = `900 ${nameFontSize}px sans-serif`;
        }
        ctx.fillText(donorName, rightX, 320);

        // Donation Count
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COLOR_RED;
        ctx.font = '900 80px sans-serif';
        ctx.fillText(`${getBengaliOrdinal(totalDonations)} রক্তদান`, rightX, 440);

        // Date
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const formattedDate = toBengaliNumber(`${day}/${month}/${year}`);
        
        ctx.fillStyle = COLOR_GREEN;
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText(formattedDate, rightX, 520);

        // 4. User Image (Bottom Left, Partially Cut Off)
        const reader = new FileReader();
        reader.onload = (e) => {
          const userImg = new Image();
          userImg.onload = () => {
            const imgRadius = 550; 
            const imgX = 280; 
            const imgY = 1080; 

            // Light background ring (Offset shadow)
            ctx.beginPath();
            ctx.arc(imgX + 30, imgY + 30, imgRadius + 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(5, 150, 105, 0.1)'; // Light emerald shadow
            ctx.fill();

            // Image clipping
            ctx.save();
            ctx.beginPath();
            ctx.arc(imgX, imgY, imgRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const scale = Math.max((imgRadius * 2) / userImg.width, (imgRadius * 2) / userImg.height);
            const x = imgX - (userImg.width * scale) / 2;
            const y = imgY - (userImg.height * scale) / 2;
            ctx.drawImage(userImg, x, y, userImg.width * scale, userImg.height * scale);
            ctx.restore();

            // Thick Green Border
            ctx.beginPath();
            ctx.arc(imgX, imgY, imgRadius, 0, Math.PI * 2);
            ctx.lineWidth = 35;
            ctx.strokeStyle = COLOR_GREEN;
            ctx.stroke();

            // 5. Blood Group Badge (Pill Design)
            const badgeX = 880;
            const badgeY = 1150;
            const badgeWidth = 320;
            const badgeHeight = 140;
            const badgeRadius = 70;
            const badgeStartX = badgeX - badgeWidth / 2;
            const badgeStartY = badgeY - badgeHeight / 2;

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetY = 8;
            
            // Draw Pill (White background)
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(badgeStartX, badgeStartY, badgeWidth, badgeHeight, badgeRadius);
            } else {
              ctx.rect(badgeStartX, badgeStartY, badgeWidth, badgeHeight);
            }
            ctx.fillStyle = COLOR_WHITE;
            ctx.fill();
            
            // Blue Border
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#0056b3'; // Deep blue border
            ctx.stroke();
            ctx.restore();

            // Blood Group Text (Red)
            ctx.fillStyle = COLOR_RED;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '900 100px sans-serif'; // Extra bold and larger
            ctx.fillText(formattedBloodGroup, badgeX, badgeY + 8);

            resolve(canvas.toDataURL('image/png'));
          };
          userImg.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      };

      // Draw Logo
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = '/logo.png';
      
      const drawLogo = (logoImg?: HTMLImageElement) => {
        // Draw Watermark first (behind everything)
        if (logoImg) {
          ctx.save();
          ctx.globalAlpha = 0.05; // Very light
          const wmWidth = 800;
          const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
          // Center of the canvas
          ctx.drawImage(logoImg, 540 - wmWidth / 2, 750 - wmHeight / 2, wmWidth, wmHeight);
          ctx.restore();
        }

        const logoStartX = 80;
        const logoStartY = 80;
        if (logoImg) {
          const logoW = 750; // Increased from 520
          const logoH = (logoImg.height / logoImg.width) * logoW;
          ctx.drawImage(logoImg, logoStartX, logoStartY, logoW, logoH);
        } else {
          ctx.fillStyle = COLOR_GREEN;
          ctx.font = 'bold 40px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('লোগোর স্থান', logoStartX, logoStartY);
        }
        drawContent(logoImg);
      };

      logo.onload = () => drawLogo(logo);
      logo.onerror = () => drawLogo();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let f3Status = 'completed';
      let f7Status = 'completed';
      
      if (date) {
        f3Status = 'pending';
        f7Status = 'pending';
      }

      const donorRef = doc(db, 'donors', donor.id);
      await updateDoc(donorRef, {
        lastDonationDate: date,
        totalDonations: increment(1),
        followUp3DayStatus: f3Status,
        followUp3DayNextReminder: '',
        followUp7DayStatus: f7Status,
        followUp7DayNextReminder: ''
      });

      await logActivity(donor.id, 'update', donor.name, `রক্তদান রেকর্ড করা হয়েছে (${date})`);

      // Leaderboard Logic: Award points for donation (Only for Editors)
      if (auth.currentUser?.uid) {
        const volunteerRef = doc(db, 'users', auth.currentUser.uid);
        const volunteerSnap = await getDoc(volunteerRef);
        
        if (volunteerSnap.exists() && volunteerSnap.data().role === 'editor') {
          const isOwnDonor = donor.addedBy === auth.currentUser.uid;
          const pointsToAward = isOwnDonor ? 10 : 5;
          const pointsField = isOwnDonor ? 'pointsFromOwnDonors' : 'pointsFromOtherDonors';

          await updateDoc(volunteerRef, {
            points: increment(pointsToAward),
            [pointsField]: increment(pointsToAward)
          });
        }
      }

      if (imageFile) {
        setStep('generating');
        try {
          const url = await generatePoster(imageFile, donor.name, donor.bloodGroup, date, (donor.totalDonations || 0) + 1);
          setPosterUrl(url);
          setStep('result');
        } catch (err) {
          console.error("Failed to generate poster:", err);
          onClose();
        }
      } else {
        onClose();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${donor.id}`);
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (posterUrl) {
      const a = document.createElement('a');
      a.href = posterUrl;
      a.download = `${donor.name}_donation_poster.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="bg-emerald-600 dark:bg-slate-950 p-5 text-white flex justify-between items-center shrink-0 transition-colors duration-300">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Droplet size={20} className="fill-current" />
            {step === 'result' ? 'পোস্টার তৈরি হয়েছে' : 'রক্তদান রেকর্ড করুন'}
          </h2>
          <button onClick={onClose} className="p-2 bg-emerald-500 dark:bg-slate-800 hover:bg-emerald-400 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 bg-white dark:bg-slate-900 transition-colors duration-300">
          {step === 'form' && (
            <form id="donation-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-4 transition-colors duration-300">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-full text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">ডোনার</p>
                  <p className="text-lg font-bold text-emerald-950 dark:text-emerald-100">{donor.name}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                  রক্তদানের তারিখ
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={18} className="text-emerald-500" />
                  </div>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="pl-10 w-full p-3 border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
                  এই তারিখটি ডোনারের সর্বশেষ রক্তদানের তারিখ হিসেবে সংরক্ষিত হবে এবং আগামী ১২০ দিনের জন্য ডোনারকে অনুপলব্ধ হিসেবে চিহ্নিত করা হবে।
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">
                  ডোনারের ছবি (ঐচ্ছিক)
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-emerald-400 transition-all"
                >
                  {imagePreview ? (
                    <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-100 dark:border-emerald-900/30">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Upload className="text-white" size={24} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-emerald-50 dark:bg-slate-800 p-3 rounded-full text-emerald-600 dark:text-emerald-400 mb-3">
                        <ImageIcon size={28} />
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">ছবি আপলোড করতে ক্লিক করুন</p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 text-center">ছবি দিলে একটি সুন্দর রক্তদান পোস্টার তৈরি হবে</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </form>
          )}

          {step === 'generating' && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 size={48} className="text-emerald-600 dark:text-emerald-400 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-slate-200">পোস্টার তৈরি হচ্ছে...</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">দয়া করে একটু অপেক্ষা করুন</p>
            </div>
          )}

          {step === 'result' && posterUrl && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="relative w-full aspect-[1080/1500] rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800">
                <img src={posterUrl} alt="Generated Poster" className="w-full h-full object-contain" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 shrink-0 transition-colors duration-300">
          {step === 'form' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-800 font-bold transition-colors"
              >
                বাতিল
              </button>
              <button
                type="submit"
                form="donation-form"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center disabled:opacity-70"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'সংরক্ষণ করুন'}
              </button>
            </div>
          )}

          {step === 'result' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-800 font-bold transition-colors"
              >
                বন্ধ করুন
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold shadow-md shadow-emerald-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                ডাউনলোড
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordDonationModal;
