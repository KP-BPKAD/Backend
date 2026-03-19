// src/components/LetterForm.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Container, Form, Button, Row, Col, Card, Alert } from 'react-bootstrap';

const LetterForm = ({ isEdit = false, isView = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    noUrut: '',
    noSurat: '',
    tanggalTerima: new Date().toISOString().split('T')[0],
    tanggalDisposisi: '',
    asalSurat: '',
    perihal: '',
    keterangan: '',
    tanggalDisposisiBidang: '',
    jabatan: '',
    nama: '',
    nip: '',
    penerimaEmail: '',
    klasifikasiId: '',
    arsipDigital: ''
  });

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 🔒 proteksi double-submit
  const [error, setError] = useState('');
  const [classifications, setClassifications] = useState([]);

  // Fetch data hanya jika edit atau view
  useEffect(() => {
    const fetchData = async () => {
      try {
        const classRes = await api.get('/classifications');
        setClassifications(classRes.data);

        if ((isEdit || isView) && id) {
          const res = await api.get(`/letters/${id}`);
          const letter = res.data;

          const jabatan = letter.jabatan || letter.pengirimId?.jabatan || '';
          const nama = letter.nama || letter.pengirimId?.nama || '';
          const nip = letter.nip || letter.pengirimId?.nip || '';

          setFormData({
            noUrut: letter.noUrut,
            noSurat: letter.noSurat,
            tanggalTerima: letter.tanggalTerima?.split('T')[0] || '',
            tanggalDisposisi: letter.tanggalDisposisi?.split('T')[0] || '',
            asalSurat: letter.asalSurat || '',
            perihal: letter.perihal || '',
            keterangan: letter.keterangan || '',
            tanggalDisposisiBidang: letter.tanggalDisposisiBidang?.split('T')[0] || '',
            jabatan,
            nama,
            nip,
            penerimaEmail: letter.penerimaId?.email || '',
            klasifikasiId: letter.klasifikasiId && typeof letter.klasifikasiId === 'object'
              ? letter.klasifikasiId._id || letter.klasifikasiId
              : letter.klasifikasiId || '',
            arsipDigital: letter.arsipDigital || ''
          });
        }
      } catch (err) {
        console.error('Gagal memuat data surat:', err);
        alert('Gagal memuat data surat');
        navigate('/dashboard');
      }
    };
    fetchData();
  }, [id, isEdit, isView, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSubmitting) return; // 🔒 Double-submit protection
    setIsSubmitting(true);
    setError('');
    setLoading(true);

    try {
      const formPayload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formPayload.append(key, value);
      });
      if (file) formPayload.append('arsipDigital', file);

      if (isEdit) {
        await api.put(`/letters/${id}`, formPayload);
        alert('Surat berhasil diperbarui!');
      } else {
        await api.post('/letters', formPayload);
        alert('Surat berhasil dikirim!');
      }
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan surat';
      setError(msg);
      console.error('Submit error:', err);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  // Mode VIEW
  if (isView) {
    const handleDownload = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('Silakan login ulang.');
          return;
        }

        const response = await fetch(
          `http://localhost:5000/api/letters/${id}/download`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (!response.ok) {
          const error = await response.json();
          alert(error.message || 'Gagal mengunduh surat.');
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `surat_${formData.noSurat.replace(/\//g, '_')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert('Surat + data berhasil diunduh!');
      } catch (err) {
        console.error('Download error:', err);
        alert('Gagal mengunduh. Coba lagi nanti.');
      }
    };

    return (
      <Container className="mt-4">
        <Card>
          <Card.Body>
            <Card.Title>Detail Surat</Card.Title>

            {formData.arsipDigital && (
              <div className="mb-4">
                <h5>Arsip Digital</h5>
                <Alert variant="info">
                  <strong>File:</strong> {formData.arsipDigital.split('/').pop()}
                  <br />
                  <a 
                    href={`http://localhost:5000${formData.arsipDigital}`} 
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-primary mt-2"
                  >
                    📄 Buka File di Tab Baru
                  </a>
                </Alert>
              </div>
            )}

            <Row>
              <Col md={6}>
                <p><strong>No Urut:</strong> {formData.noUrut}</p>
                <p><strong>No Surat:</strong> {formData.noSurat}</p>
                <p><strong>Tanggal Terima:</strong> {new Date(formData.tanggalTerima).toLocaleDateString()}</p>
                <p><strong>Tanggal Disposisi:</strong> {formData.tanggalDisposisi ? new Date(formData.tanggalDisposisi).toLocaleDateString() : '-'}</p>
                <p><strong>Asal Surat:</strong> {formData.asalSurat}</p>
                <p><strong>Penerima:</strong> {formData.penerimaEmail || '–'}</p>
                <p><strong>Klasifikasi:</strong> 
                  {formData.klasifikasiId && (
                    classifications.find(cls => cls._id === formData.klasifikasiId) ? (
                      <span 
                        className="badge"
                        style={{ 
                          backgroundColor: classifications.find(cls => cls._id === formData.klasifikasiId)?.warna || '#007bff',
                          color: '#fff'
                        }}
                      >
                        {classifications.find(cls => cls._id === formData.klasifikasiId)?.nama || 'Tanpa Nama'}
                      </span>
                    ) : (
                      <span className="text-muted">-</span>
                    )
                  )}
                </p>
              </Col>
              <Col md={6}>
                <p><strong>Perihal:</strong> {formData.perihal}</p>
                <p><strong>Keterangan:</strong> {formData.keterangan}</p>
                <p><strong>Tgl Disposisi Bidang:</strong> {formData.tanggalDisposisiBidang ? new Date(formData.tanggalDisposisiBidang).toLocaleDateString() : '-'}</p>
                <p><strong>Jabatan:</strong> {formData.jabatan}</p>
                <p><strong>Nama:</strong> {formData.nama}</p>
                <p><strong>NIP:</strong> {formData.nip}</p>
              </Col>
            </Row>

            <div className="mt-3">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Kembali
              </Button>{' '}
              <Button variant="success" onClick={handleDownload}>
                Unduh Surat & Data
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  // Mode CREATE / EDIT
  return (
    <Container className="mt-4">
      <Card>
        <Card.Body>
          <Card.Title>{isEdit ? 'Edit Surat' : 'Kirim Surat Baru'}</Card.Title>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>No Urut</Form.Label>
                  <Form.Control
                    type="number"
                    name="noUrut"
                    value={formData.noUrut}
                    onChange={handleChange}
                    required
                    min="1"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>No Surat</Form.Label>
                  <Form.Control
                    type="text"
                    name="noSurat"
                    value={formData.noSurat}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Terima</Form.Label>
                  <Form.Control
                    type="date"
                    name="tanggalTerima"
                    value={formData.tanggalTerima}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Disposisi</Form.Label>
                  <Form.Control
                    type="date"
                    name="tanggalDisposisi"
                    value={formData.tanggalDisposisi}
                    onChange={handleChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Asal Surat</Form.Label>
              <Form.Control
                type="text"
                name="asalSurat"
                value={formData.asalSurat}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Perihal</Form.Label>
              <Form.Control
                type="text"
                name="perihal"
                value={formData.perihal}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Keterangan</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="keterangan"
                value={formData.keterangan}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tanggal Disposisi Bidang</Form.Label>
              <Form.Control
                type="date"
                name="tanggalDisposisiBidang"
                value={formData.tanggalDisposisiBidang}
                onChange={handleChange}
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Jabatan</Form.Label>
                  <Form.Control
                    type="text"
                    name="jabatan"
                    value={formData.jabatan}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nama</Form.Label>
                  <Form.Control
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>NIP</Form.Label>
              <Form.Control
                type="text"
                name="nip"
                value={formData.nip}
                onChange={handleChange}
                required
                pattern="\d{9,20}"
                title="NIP harus 9–20 digit angka"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Penerima Email *</Form.Label>
              <Form.Control
                type="email"
                name="penerimaEmail"
                placeholder="Masukkan email penerima yang terdaftar"
                value={formData.penerimaEmail}
                onChange={handleChange}
                required={!isEdit}
                disabled={isEdit}
              />
              <Form.Text className="text-muted">
                Pastikan penerima sudah terdaftar di sistem.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Klasifikasi Arsip</Form.Label>
              <Form.Select
                name="klasifikasiId"
                value={formData.klasifikasiId}
                onChange={handleChange}
              >
                <option value="">-- Pilih Klasifikasi --</option>
                {classifications.map(cls => (
                  <option key={cls._id} value={cls._id}>
                    {cls.nama}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Pilih klasifikasi untuk mengelompokkan surat berdasarkan prioritas.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Arsip Digital (PDF/DOCX/XLSX)</Form.Label>
              <Form.Control
                type="file"
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              disabled={loading || isSubmitting}
              className="w-100"
            >
              {loading || isSubmitting ? 'Memproses...' : isEdit ? 'Perbarui Surat' : 'Kirim Surat'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default LetterForm;
