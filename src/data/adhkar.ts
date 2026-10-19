export interface Dhikr {
  id: string;
  arabic: string;
  title: string; // short English label
  count: number;
  note?: string;
}

export interface AdhkarCollection {
  id: 'morning' | 'evening' | 'sleep' | 'after';
  title: string;
  arabicTitle: string;
  subtitle: string;
  items: Dhikr[];
}

const AYAT_AL_KURSI: Dhikr = {
  id: 'kursi',
  title: 'Ayat al-Kursi',
  count: 1,
  arabic:
    'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
};

const IKHLAS = (count: number): Dhikr => ({
  id: 'ikhlas',
  title: 'Surah Al-Ikhlas',
  count,
  arabic:
    'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
});

const FALAQ = (count: number): Dhikr => ({
  id: 'falaq',
  title: 'Surah Al-Falaq',
  count,
  arabic:
    'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
});

const NAS = (count: number): Dhikr => ({
  id: 'nas',
  title: 'Surah An-Nas',
  count,
  arabic:
    'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ',
});

const SAYYID_ISTIGHFAR: Dhikr = {
  id: 'sayyid-istighfar',
  title: 'Sayyid al-Istighfar',
  count: 1,
  arabic:
    'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
};

const SHARED_PROTECTION: Dhikr[] = [
  {
    id: 'bismillah-protect',
    title: 'Protection by His Name',
    count: 3,
    arabic:
      'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
  },
  {
    id: 'radeetu',
    title: 'Contentment',
    count: 3,
    arabic:
      'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا',
  },
  {
    id: 'afini',
    title: 'Wellbeing',
    count: 3,
    arabic:
      'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ',
  },
  {
    id: 'ya-hayy',
    title: 'Seeking help',
    count: 1,
    arabic:
      'يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ',
  },
  {
    id: 'hasbiyallah',
    title: 'Reliance',
    count: 7,
    arabic:
      'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
  },
];

export const MORNING: AdhkarCollection = {
  id: 'morning',
  title: 'Morning Adhkar',
  arabicTitle: 'أذكار الصباح',
  subtitle: 'After Fajr until sunrise',
  items: [
    AYAT_AL_KURSI,
    IKHLAS(3),
    FALAQ(3),
    NAS(3),
    {
      id: 'asbahna',
      title: 'We have reached the morning',
      count: 1,
      arabic:
        'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    },
    {
      id: 'bika-asbahna',
      title: 'By You we enter the morning',
      count: 1,
      arabic:
        'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    },
    SAYYID_ISTIGHFAR,
    ...SHARED_PROTECTION,
    {
      id: 'tahleel-10',
      title: 'Tahleel',
      count: 10,
      arabic:
        'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    },
    {
      id: 'subhan-bihamdihi',
      title: 'Tasbeeh',
      count: 100,
      arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    },
  ],
};

export const EVENING: AdhkarCollection = {
  id: 'evening',
  title: 'Evening Adhkar',
  arabicTitle: 'أذكار المساء',
  subtitle: 'After Asr until Maghrib',
  items: [
    AYAT_AL_KURSI,
    IKHLAS(3),
    FALAQ(3),
    NAS(3),
    {
      id: 'amsayna',
      title: 'We have reached the evening',
      count: 1,
      arabic:
        'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ',
    },
    {
      id: 'bika-amsayna',
      title: 'By You we enter the evening',
      count: 1,
      arabic:
        'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
    },
    SAYYID_ISTIGHFAR,
    ...SHARED_PROTECTION,
    {
      id: 'kalimat-tammat',
      title: 'Perfect words of Allah',
      count: 3,
      arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
    },
    {
      id: 'subhan-bihamdihi',
      title: 'Tasbeeh',
      count: 100,
      arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    },
  ],
};

export const SLEEP: AdhkarCollection = {
  id: 'sleep',
  title: 'Before Sleep',
  arabicTitle: 'أذكار النوم',
  subtitle: 'In bed, lights off',
  items: [
    AYAT_AL_KURSI,
    {
      id: 'baqarah-end',
      title: 'Last two ayat of Al-Baqarah',
      count: 1,
      arabic:
        'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ ۝ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ',
    },
    { ...IKHLAS(3), note: 'Blow into cupped hands and wipe over the body' },
    FALAQ(3),
    NAS(3),
    {
      id: 'mulk',
      title: 'Surah Al-Mulk',
      count: 1,
      arabic: 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
      note: 'Recite the full surah from your Mushaf, then tap',
    },
    {
      id: 'qini',
      title: 'Protect me from Your punishment',
      count: 3,
      arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
    },
    { id: 'subhanallah-33', title: 'SubhanAllah', count: 33, arabic: 'سُبْحَانَ اللَّهِ' },
    { id: 'alhamdulillah-33', title: 'Alhamdulillah', count: 33, arabic: 'الْحَمْدُ لِلَّهِ' },
    { id: 'allahuakbar-34', title: 'Allahu Akbar', count: 34, arabic: 'اللَّهُ أَكْبَرُ' },
    {
      id: 'bismika',
      title: 'In Your name I die and live',
      count: 1,
      arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    },
  ],
};

export const AFTER_PRAYER: AdhkarCollection = {
  id: 'after',
  title: 'After Prayer',
  arabicTitle: 'أذكار بعد الصلاة',
  subtitle: 'Right after salam',
  items: [
    { id: 'istighfar-3', title: 'Astaghfirullah', count: 3, arabic: 'أَسْتَغْفِرُ اللَّهَ' },
    {
      id: 'antas-salam',
      title: 'You are Peace',
      count: 1,
      arabic:
        'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
    },
    {
      id: 'la-mania',
      title: 'None can withhold',
      count: 1,
      arabic:
        'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ',
    },
    { id: 'subhanallah-33', title: 'SubhanAllah', count: 33, arabic: 'سُبْحَانَ اللَّهِ' },
    { id: 'alhamdulillah-33', title: 'Alhamdulillah', count: 33, arabic: 'الْحَمْدُ لِلَّهِ' },
    { id: 'allahuakbar-33', title: 'Allahu Akbar', count: 33, arabic: 'اللَّهُ أَكْبَرُ' },
    {
      id: 'tahleel-100th',
      title: 'Completing the hundred',
      count: 1,
      arabic:
        'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
    },
    AYAT_AL_KURSI,
    {
      id: 'aini',
      title: 'Help me remember You',
      count: 1,
      arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    },
    IKHLAS(1),
    FALAQ(1),
    NAS(1),
  ],
};

export function collectionFor(session: string): AdhkarCollection {
  if (session === 'morning') return MORNING;
  if (session === 'evening') return EVENING;
  if (session === 'sleep') return SLEEP;
  return AFTER_PRAYER;
}

export const TASBIH_PHRASES = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', title: 'SubhanAllah' },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', title: 'Alhamdulillah' },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', title: 'Allahu Akbar' },
  { id: 'tahleel', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', title: 'La ilaha illa Allah' },
  { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ', title: 'Astaghfirullah' },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', title: 'Salawat' },
];

export const SUNNAH_HABITS: { id: string; title: string; detail: string; days?: number[] }[] = [
  { id: 'siwak', title: 'Siwak', detail: 'Before prayer or on waking' },
  { id: 'duha', title: 'Duha prayer', detail: '2 rak‘ahs after sunrise' },
  { id: 'salawat', title: 'Salawat ×10', detail: 'Send blessings on the Prophet ﷺ' },
  { id: 'wudu-sleep', title: 'Sleep with wudu', detail: 'On your right side' },
  { id: 'sadaqah', title: 'A small sadaqah', detail: 'Even a smile counts' },
  { id: 'fast', title: 'Voluntary fast', detail: 'Monday & Thursday', days: [1, 4] },
];
