// controllers/reportController.js
const Letter = require('../models/Letter');
const Classification = require('../models/Classification');
const { logActivity } = require('../utils/logActivity'); // ← tambahkan ini

const getMonthlyReport = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Ambil semua klasifikasi
    const classifications = await Classification.find().lean();
    const classificationMap = {};
    classifications.forEach(cls => {
      classificationMap[cls._id.toString()] = cls;
    });

    // Ambil semua surat di tahun tertentu
    const letters = await Letter.find({
      tanggalTerima: {
        $gte: new Date(`${targetYear}-01-01`),
        $lt: new Date(`${targetYear + 1}-01-01`)
      }
    }).sort({ createdAt: 1 });

    // Filter unik berdasarkan suratId
    const uniqueSurats = Object.values(
      letters.reduce((acc, letter) => {
        if (!acc[letter.suratId]) {
          acc[letter.suratId] = letter;
        }
        return acc;
      }, {})
    );

    // Siapkan data bulanan
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlyData = monthNames.map(name => ({
      namaBulan: name,
      totalSurat: 0,
      suratMasuk: 0,
      suratKeluar: 0,
      klasifikasi: {}
    }));

    // Hitung: 1 surat = 1 dikirim + 1 diterima
    uniqueSurats.forEach(surat => {
      const monthIndex = new Date(surat.tanggalTerima).getMonth();
      const month = monthlyData[monthIndex];

      month.totalSurat += 1;
      month.suratKeluar += 1;  // setiap surat dikirim sekali
      month.suratMasuk += 1;   // setiap surat diterima sekali

      // Klasifikasi
      if (surat.klasifikasiId) {
        const clsId = surat.klasifikasiId.toString();
        if (!month.klasifikasi[clsId]) {
          const cls = classificationMap[clsId];
          month.klasifikasi[clsId] = {
            nama: cls?.nama || 'Tanpa Nama',
            warna: cls?.warna || '#ccc',
            jumlah: 0
          };
        }
        month.klasifikasi[clsId].jumlah += 1;
      }
    });

    // Summary global
    const globalSummary = {};
    uniqueSurats.forEach(surat => {
      if (surat.klasifikasiId) {
        const clsId = surat.klasifikasiId.toString();
        const cls = classificationMap[clsId];
        if (!globalSummary[clsId]) {
          globalSummary[clsId] = {
            nama: cls?.nama || 'Tanpa Nama',
            warna: cls?.warna || '#ccc',
            jumlah: 0
          };
        }
        globalSummary[clsId].jumlah += 1;
      }
    });

    await logActivity(req.user.id, 'view_report', `User mengakses laporan bulanan tahun ${targetYear}`, req);

    res.json({
      year: targetYear,
      data: monthlyData,
      summary: globalSummary
    });

  } catch (err) {
    console.error('Error laporan:', err);
    res.status(500).json({ message: 'Gagal mengambil data laporan.' });
  }
};

module.exports = { getMonthlyReport };