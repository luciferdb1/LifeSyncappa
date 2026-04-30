import React, { useState, useRef } from 'react';
import { X, Calendar, Loader2, Droplet, Award, Upload, Download, Image as ImageIcon, Facebook, CheckCircle2 } from 'lucide-react';
import { Donor } from '../types';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, increment, getDoc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { logActivity } from '../services/logService';

interface RecordDonationModalProps {
  donor: Donor;
  userRole?: string;
  onClose: () => void;
}

const RecordDonationModal: React.FC<RecordDonationModalProps> = ({ donor, userRole, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'generating' | 'result'>('form');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [postingToFacebook, setPostingToFacebook] = useState(false);
  const [facebookPostSuccess, setFacebookPostSuccess] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [postedFacebookId, setPostedFacebookId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePostToFacebook = async () => {
    if (!posterUrl) return;
    setPostingToFacebook(true);
    setFacebookPostSuccess(false);
    setPostedFacebookId(null);
    try {
      // Fetch token from Firestore
      const docRef = doc(db, 'settings', 'facebookConfig');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists() || !docSnap.data().pageAccessToken || !docSnap.data().pageId) {
        alert("Facebook page token or ID is not set. Please set it from the admin panel.");
        setPostingToFacebook(false);
        return;
      }
      
      const pageAccessToken = docSnap.data().pageAccessToken;
      const pageId = docSnap.data().pageId;

      // Convert base64 to Blob
      const base64Data = posterUrl.replace(/^data:image\/\w+;base64,/, "");
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      const blob = new Blob(byteArrays, { type: 'image/png' });

      const formData = new FormData();
      formData.append('source', blob, 'poster.png');
      formData.append('published', 'true');
      // No message appended so it posts only the image

      const url = `https://graph.facebook.com/v19.0/${pageId}/photos?access_token=${pageAccessToken}`;
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPostedFacebookId(data.post_id || data.id);
        setFacebookPostSuccess(true);
      } else {
        const data = await response.json();
        console.error("Failed to post to Facebook:", data);
        const errorMessage = data?.error?.message || "Unknown error";
        alert(`Failed to post to Facebook. Reason: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error("Error posting to Facebook:", error);
      alert(`Failed to post to Facebook. Reason: ${error.message || "Network error"}`);
    } finally {
      setPostingToFacebook(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!posterUrl) return;
    setPostingToFacebook(true);
    setSubmissionSuccess(false);

    try {
      const fileName = `pending_posters/${Date.now()}_${donor.id}.png`;
      const storageRef = ref(storage, fileName);
      await uploadString(storageRef, posterUrl, 'data_url');
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'poster_submissions'), {
        posterUrl: downloadURL,
        submittedByUid: auth.currentUser?.uid || 'unknown',
        submittedByName: auth.currentUser?.displayName || 'Unknown User',
        donorName: donor.name,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      setSubmissionSuccess(true);
    } catch (error: any) {
      console.error("Error submitting poster:", error);
      alert(`Failed to submit poster. Reason: ${error.message || "Network error"}`);
    } finally {
      setPostingToFacebook(false);
    }
  };

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

      // Helper for English Ordinal
      const getEnglishOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      // Determine Title
      let title = 'Goodwill Ambassador';
      if (totalDonations >= 50) title = 'Legendary Donor';
      else if (totalDonations >= 30) title = 'Beacon of Humanity';
      else if (totalDonations >= 20) title = 'Blood Warrior';
      else if (totalDonations >= 10) title = 'Life Savior';
      else if (totalDonations >= 5) title = 'Dedicated Donor';

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
        const rightX = 1040; // Pushed closer to the right border (Canvas width is 1080)

        // Title Highlight (Attractive Gradient Pill Box)
        ctx.font = '900 60px sans-serif';
        const titleText = `★ ${title} ★`;
        const textWidth = ctx.measureText(titleText).width;
        const boxWidth = textWidth + 100;
        const boxHeight = 100;
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
        const safeName = donorName.trim();
        while (ctx.measureText(safeName).width > 800 && nameFontSize > 50) {
          nameFontSize -= 5;
          ctx.font = `900 ${nameFontSize}px sans-serif`;
        }
        ctx.fillText(safeName, rightX, 320);

        // Donation Count
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COLOR_RED;
        ctx.font = '900 80px sans-serif';
        ctx.fillText(`${getEnglishOrdinal(totalDonations)} Donation`, rightX, 440);

        // Date
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        
        ctx.textAlign = 'right';
        ctx.fillStyle = COLOR_GREEN;
        ctx.font = '900 60px sans-serif';
        ctx.fillText(formattedDate.trim(), rightX, 530);

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
          const wmWidth = 700;
          const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
          // Position behind the text block (Top Right area)
          ctx.drawImage(logoImg, 1040 - wmWidth + 50, 350 - wmHeight / 2, wmWidth, wmHeight);
          ctx.restore();
        }

        const logoStartX = 30; // Pushed to the left corner
        const logoStartY = 30; // Pushed to the top corner
        if (logoImg) {
          const logoW = 280; // Reduced logo size slightly as requested
          const logoH = (logoImg.height / logoImg.width) * logoW;
          ctx.drawImage(logoImg, logoStartX, logoStartY, logoW, logoH);
        } else {
          ctx.fillStyle = COLOR_GREEN;
          ctx.font = 'bold 40px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('Logo Here', logoStartX, logoStartY);
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

      await logActivity(donor.id, 'update', donor.name, `Donation recorded (${date})`);

      // Leaderboard Logic: Award points for donation
      if (auth.currentUser?.uid) {
        const volunteerRef = doc(db, 'users', auth.currentUser.uid);
        const volunteerSnap = await getDoc(volunteerRef);
        
        if (volunteerSnap.exists() && volunteerSnap.data().role === 'volunteer') {
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
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
        <div className="bg-emerald-600 dark:bg-slate-950 p-5 text-white flex justify-between items-center shrink-0 transition-colors duration-300 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl shadow-inner border border-white/10">
              <Droplet size={24} className="text-emerald-300 fill-current" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                {step === 'result' ? 'Poster Created' : 'Record Donation'}
              </h3>
              <p className="text-emerald-200/60 text-[10px] font-black uppercase tracking-widest mt-0.5">Help us track blood donations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-5 sm:p-8 overflow-y-auto overscroll-contain bg-slate-50/50 dark:bg-slate-900/50 transition-colors duration-300">
          <div className="max-w-2xl mx-auto">
            {step === 'form' && (
              <form id="donation-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border-2 border-emerald-100 dark:border-emerald-900/30">
                      <Award size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recording for</p>
                      <h4 className="text-2xl font-black text-slate-900 dark:text-white">{donor.name}</h4>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Donation Date</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-emerald-500">
                          <Calendar size={20} className="text-slate-400" />
                        </div>
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full pl-14 pr-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-emerald-500 dark:focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-slate-800 dark:text-slate-200 font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2 ml-1 leading-relaxed italic">
                        * This will mark the donor as unavailable for the next 120 days.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Donor Photo (Optional)</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="relative h-48 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all cursor-pointer group overflow-hidden flex flex-col items-center justify-center gap-3"
                      >
                        {imagePreview ? (
                          <>
                            <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <p className="text-white font-black text-xs uppercase tracking-widest">Change Photo</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                              <ImageIcon size={24} />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-black text-slate-600 dark:text-slate-300">Click to upload</p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">PNG, JPG up to 5MB</p>
                            </div>
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
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-3xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 uppercase tracking-widest text-sm disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  Record & Generate Poster
                </button>
              </form>
            )}

            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-100 dark:border-emerald-900/20 border-t-emerald-600 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                    <Droplet size={32} className="fill-current animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Creating Poster</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">We're generating a beautiful appreciation poster...</p>
                </div>
              </div>
            )}

            {step === 'result' && posterUrl && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview</span>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    </div>
                  </div>
                  <div className="p-4 sm:p-8">
                    <img 
                      src={posterUrl} 
                      alt="Donation Poster" 
                      className="w-full rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={handleDownload}
                    className="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black py-4 rounded-2xl transition-all border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    <Download size={18} />
                    Download Poster
                  </button>
                  {userRole === 'volunteer' ? (
                    <button 
                      onClick={handleSubmitForApproval}
                      disabled={postingToFacebook || submissionSuccess}
                      className={`flex-1 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs shadow-xl ${
                        submissionSuccess 
                        ? 'bg-emerald-100 text-emerald-700 shadow-none' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                      }`}
                    >
                      {postingToFacebook ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      {submissionSuccess ? 'Submitted for Approval' : 'Submit for Approval'}
                    </button>
                  ) : (
                    <button 
                      onClick={handlePostToFacebook}
                      disabled={postingToFacebook || facebookPostSuccess}
                      className={`flex-1 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs shadow-xl ${
                        facebookPostSuccess 
                        ? 'bg-emerald-100 text-emerald-700 shadow-none' 
                        : 'bg-[#1877F2] hover:bg-[#166fe5] text-white shadow-blue-500/20'
                      }`}
                    >
                      {postingToFacebook ? <Loader2 size={18} className="animate-spin" /> : <Facebook size={18} />}
                      {facebookPostSuccess ? 'Posted to Facebook' : 'Post to Facebook'}
                    </button>
                  )}
                </div>

                {facebookPostSuccess && postedFacebookId && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Successfully posted!</p>
                    </div>
                    <a 
                      href={`https://facebook.com/${postedFacebookId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-black text-emerald-600 hover:underline uppercase tracking-widest"
                    >
                      View Post
                    </a>
                  </div>
                )}
                
                {submissionSuccess && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-600" size={20} />
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Poster submitted for approval!</p>
                    </div>
                  </div>
                )}

                <button 
                  onClick={onClose}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-5 rounded-3xl transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                >
                  Done & Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordDonationModal;
