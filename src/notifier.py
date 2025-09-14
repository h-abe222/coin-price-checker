"""
メール通知
Gmail SMTP経由で価格変動アラートを送信
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
import os
from datetime import datetime

class EmailNotifier:
    """Gmail経由でメール通知"""

    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("GMAIL_ADDRESS")
        self.sender_password = os.getenv("GMAIL_APP_PASSWORD")
        self.recipient_email = os.getenv("RECIPIENT_EMAIL")
        self.currency = os.getenv("CURRENCY", "JPY")

        if not all([self.sender_email, self.sender_password, self.recipient_email]):
            raise ValueError("Email configuration missing. Check environment variables.")

    def send_alert(self, alerts: List[Dict]):
        """価格変動アラートを送信"""
        if not alerts:
            return

        subject = f"BullionStar Price Alert - {len(alerts)} changes detected"
        body = self._create_email_body(alerts)

        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.sender_email
        msg['To'] = self.recipient_email

        html_part = MIMEText(body, 'html')
        msg.attach(html_part)

        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.send_message(msg)

        print(f"Alert email sent to {self.recipient_email}")

    def _create_email_body(self, alerts: List[Dict]) -> str:
        """メール本文をHTML形式で作成"""
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; }}
                .header {{ background-color: #f0f0f0; padding: 20px; }}
                .alert {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; }}
                .price-up {{ color: #27ae60; }}
                .price-down {{ color: #e74c3c; }}
                .footer {{ margin-top: 30px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>BullionStar Price Alert</h2>
                <p>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
        """

        for alert in alerts:
            change_class = "price-up" if alert['change_percent'] > 0 else "price-down"
            sign = "+" if alert['change_percent'] > 0 else ""

            # 通貨に応じた価格表示
            if self.currency == "JPY":
                current_price_str = f"¥{alert['current_price']:,.0f}"
                previous_price_str = f"¥{alert['previous_price']:,.0f}"
            else:
                current_price_str = f"{self.currency} ${alert['current_price']:,.2f}"
                previous_price_str = f"{self.currency} ${alert['previous_price']:,.2f}"

            html += f"""
            <div class="alert">
                <h3>{alert['product_name']}</h3>
                <table>
                    <tr>
                        <td><strong>Current Price:</strong></td>
                        <td>{current_price_str}</td>
                    </tr>
                    <tr>
                        <td><strong>Previous Price:</strong></td>
                        <td>{previous_price_str}</td>
                    </tr>
                    <tr>
                        <td><strong>Change:</strong></td>
                        <td class="{change_class}">
                            {sign}{alert['change_percent']:.2f}%
                        </td>
                    </tr>
                </table>
                <p><a href="{alert['url']}">View Product</a></p>
            </div>
            """

        html += """
            <div class="footer">
                <p>This is an automated alert from BullionStar Price Monitor.</p>
                <p>To adjust settings, update the GitHub repository configuration.</p>
            </div>
        </body>
        </html>
        """

        return html