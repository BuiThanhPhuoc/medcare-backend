/**
 * Export Utilities - Excel & PDF
 * Cung cấp hàm để xuất dữ liệu ra Excel (.xlsx) và PDF
 */

const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const path = require('path');

/**
 * Xuất dữ liệu ra Excel
 * @param {Array} data - Mảng object chứa dữ liệu
 * @param {Array} columns - Định nghĩa cột [{header: 'Tên', key: 'name', width: 20}, ...]
 * @param {String} sheetName - Tên sheet trong workbook
 * @param {String} title - Tiêu đề báo cáo (optional)
 * @returns {Promise} Buffer file Excel
 */
const exportToExcel = async (data, columns, sheetName = 'Sheet1', title = null) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Thêm tiêu đề nếu có
        if (title) {
            worksheet.mergeCells('A1:D1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = title;
            titleCell.font = { bold: true, size: 14 };
            titleCell.alignment = { horizontal: 'center', vertical: 'center' };
            worksheet.getRow(1).height = 25;
            worksheet.insertRows(1, 1);
        }

        // Thiết lập các cột
        worksheet.columns = columns.map(col => ({
            header: col.header,
            key: col.key,
            width: col.width || 15,
            style: { alignment: { horizontal: 'left' } }
        }));

        // Định dạng header
        const headerRow = worksheet.getRow(title ? 2 : 1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3b82f6' } // Xanh Blue
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'center' };
        });
        headerRow.height = 20;

        // Thêm dữ liệu
        data.forEach((row, index) => {
            const excelRow = worksheet.addRow(row);
            excelRow.eachCell((cell) => {
                cell.alignment = { horizontal: 'left', wrapText: true };
                // Alternating row colors
                if (index % 2 === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF3F4F6' } // Grey
                    };
                }
            });
        });

        // Trả về Buffer thay vì file
        return await workbook.xlsx.writeBuffer();
    } catch (error) {
        console.error('❌ Lỗi export Excel:', error);
        throw error;
    }
};

/**
 * Xuất dữ liệu ra PDF từ HTML
 * @param {String} htmlContent - Nội dung HTML của báo cáo
 * @param {String} filename - Tên file PDF
 * @returns {Promise} Buffer file PDF
 */
const exportToPDF = async (htmlContent, filename = 'report.pdf') => {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        // Set content HTML
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle2'
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            },
            printBackground: true
        });

        return pdfBuffer;
    } catch (error) {
        console.error('❌ Lỗi export PDF:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

/**
 * Tạo HTML report cho danh sách (Doctors, Users, etc.)
 * Generic template có thể tái sử dụng
 */
const generateListReportHTML = (title, data, columns, generatedDate = new Date()) => {
    const dateStr = generatedDate.toLocaleString('vi-VN');
    
    // Tạo header table
    const headerCells = columns
        .map(col => `<th>${col.header}</th>`)
        .join('');

    // Tạo data rows
    const dataRows = data
        .map(row => {
            const cells = columns
                .map(col => `<td>${row[col.key] || '—'}</td>`)
                .join('');
            return `<tr>${cells}</tr>`;
        })
        .join('');

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 15px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: #111827;
            font-size: 24px;
        }
        .header p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        table thead {
            background: #3b82f6;
            color: white;
        }
        table th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #e5e7eb;
        }
        table td {
            padding: 10px 12px;
            border: 1px solid #e5e7eb;
            font-size: 14px;
        }
        table tbody tr:nth-child(even) {
            background: #f9fafb;
        }
        table tbody tr:hover {
            background: #f3f4f6;
        }
        .footer {
            margin-top: 30px;
            text-align: right;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
        }
        .summary {
            margin-top: 20px;
            padding: 15px;
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            border-radius: 4px;
        }
        .summary p {
            margin: 5px 0;
            color: #1e40af;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p>Xuất lúc: ${dateStr}</p>
        </div>

        <table>
            <thead>
                <tr>${headerCells}</tr>
            </thead>
            <tbody>
                ${dataRows || '<tr><td colspan="' + columns.length + '" style="text-align: center;">Không có dữ liệu</td></tr>'}
            </tbody>
        </table>

        <div class="summary">
            <p><strong>Tổng số hàng:</strong> ${data.length}</p>
            <p><strong>Ngày in:</strong> ${dateStr}</p>
            <p><strong>Hệ thống:</strong> MedCare Management</p>
        </div>

        <div class="footer">
            <p>Đây là báo cáo được tạo tự động từ hệ thống. Vui lòng kiểm tra lại dữ liệu trước khi sử dụng.</p>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Tạo HTML report cho hóa đơn/receipt
 */
const generateInvoiceReportHTML = (invoiceData) => {
    const {
        invoiceNumber,
        date,
        patient,
        doctor,
        services = [],
        total,
        paymentMethod
    } = invoiceData;

    const serviceRows = services
        .map(srv => `
            <tr>
                <td>${srv.name}</td>
                <td style="text-align: right;">${srv.quantity}</td>
                <td style="text-align: right;">${formatVND(srv.price)}</td>
                <td style="text-align: right;">${formatVND(srv.quantity * srv.price)}</td>
            </tr>
        `)
        .join('');

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; }
        .invoice { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border: 1px solid #ddd; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; color: #3b82f6; }
        .header p { margin: 5px 0; color: #6b7280; }
        .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-box { padding: 15px; background: #f9fafb; border-radius: 4px; }
        .info-box strong { display: block; color: #3b82f6; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        table th { background: #3b82f6; color: white; padding: 10px; text-align: left; }
        table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .total-row { background: #eff6ff; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <h1>HÓA ĐƠN THANH TOÁN</h1>
            <p>Số hóa đơn: ${invoiceNumber}</p>
            <p>Ngày: ${new Date(date).toLocaleString('vi-VN')}</p>
        </div>

        <div class="invoice-info">
            <div class="info-box">
                <strong>👤 Thông tin Bệnh nhân</strong>
                <p>${patient.name || 'N/A'}</p>
                <p>SĐT: ${patient.phone || 'N/A'}</p>
            </div>
            <div class="info-box">
                <strong>👨‍⚕️ Bác sĩ khám</strong>
                <p>${doctor.name || 'N/A'}</p>
                <p>Chuyên khoa: ${doctor.specialty || 'N/A'}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Dịch vụ</th>
                    <th style="text-align: right;">Số lượng</th>
                    <th style="text-align: right;">Đơn giá</th>
                    <th style="text-align: right;">Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                ${serviceRows}
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">TỔNG CỘNG:</td>
                    <td style="text-align: right;">${formatVND(total)}</td>
                </tr>
            </tbody>
        </table>

        <p><strong>Phương thức thanh toán:</strong> ${paymentMethod || 'N/A'}</p>

        <div class="footer">
            <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
            <p>Hệ thống MedCare - © 2024</p>
        </div>
    </div>
</body>
</html>
    `;
};

// Helper: Format VND currency
const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(value);
};

module.exports = {
    exportToExcel,
    exportToPDF,
    generateListReportHTML,
    generateInvoiceReportHTML,
    formatVND
};
