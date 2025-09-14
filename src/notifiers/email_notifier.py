import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Dict, Optional
from jinja2 import Template

logger = logging.getLogger(__name__)

class EmailNotifier:
    """Gmailを使用したメール通知システム"""

    def __init__(self, gmail_address: str, gmail_app_password: str):
        self.gmail_address = gmail_address
        self.gmail_app_password = gmail_app_password
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587

    def send_price_alert(
        self,
        recipient_email: str,
        prices: Dict,
        threshold_info: Optional[Dict] = None
    ) -> bool:
        """価格アラートメールを送信"""
        try:
            # メールの内容を作成
            subject = f"金価格アラート - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            body = self._create_alert_body(prices, threshold_info)

            # メールを送信
            return self.send_email(recipient_email, subject, body, html=True)

        except Exception as e:
            logger.error(f"Failed to send price alert: {e}")
            return False

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        body: str,
        html: bool = False
    ) -> bool:
        """メールを送信"""
        try:
            # MIMEメッセージを作成
            msg = MIMEMultipart()
            msg['From'] = self.gmail_address
            msg['To'] = recipient_email
            msg['Subject'] = subject

            # 本文を追加
            if html:
                msg.attach(MIMEText(body, 'html'))
            else:
                msg.attach(MIMEText(body, 'plain'))

            # SMTPサーバーに接続して送信
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.gmail_address, self.gmail_app_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {recipient_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def send_to_multiple(
        self,
        recipients: List[str],
        subject: str,
        body: str,
        html: bool = False
    ) -> Dict[str, bool]:
        """複数の宛先にメールを送信"""
        results = {}
        for recipient in recipients:
            results[recipient] = self.send_email(recipient, subject, body, html)
        return results

    def _create_alert_body(self, prices: Dict, threshold_info: Optional[Dict] = None) -> str:
        """アラートメールの本文を作成"""
        template_str = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                .header { background-color: #f4f4f4; padding: 20px; }
                .content { padding: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                .alert { color: #d9534f; font-weight: bold; }
                .footer { margin-top: 30px; padding: 20px; background-color: #f4f4f4; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>金価格アラート通知</h2>
                <p>{{ timestamp }}</p>
            </div>

            <div class="content">
                {% if threshold_info %}
                <div class="alert">
                    <h3>アラート条件達成</h3>
                    <p>{{ threshold_info.message }}</p>
                </div>
                {% endif %}

                <h3>現在の金価格</h3>
                <table>
                    <tr>
                        <th>商品名</th>
                        <th>価格 (SGD)</th>
                        <th>取得時刻</th>
                    </tr>
                    {% for name, price_data in prices.items() %}
                    <tr>
                        <td>{{ name }}</td>
                        <td>S$ {{ "%.2f"|format(price_data.price_sgd) }}</td>
                        <td>{{ price_data.timestamp.strftime('%H:%M:%S') }}</td>
                    </tr>
                    {% endfor %}
                </table>

                {% if threshold_info and threshold_info.price_history %}
                <h3>価格推移（過去24時間）</h3>
                <ul>
                    {% for history in threshold_info.price_history[-5:] %}
                    <li>{{ history.timestamp }} - S$ {{ "%.2f"|format(history.price) }}</li>
                    {% endfor %}
                </ul>
                {% endif %}
            </div>

            <div class="footer">
                <p>このメールは自動送信されています。</p>
                <p>設定の変更は設定ファイルから行ってください。</p>
            </div>
        </body>
        </html>
        """

        template = Template(template_str)
        return template.render(
            timestamp=datetime.now().strftime('%Y年%m月%d日 %H:%M:%S'),
            prices=prices,
            threshold_info=threshold_info
        )

    def send_error_notification(self, recipient_email: str, error_message: str) -> bool:
        """エラー通知メールを送信"""
        subject = f"金価格モニター - エラー通知"
        body = f"""
        <html>
        <body>
            <h2>エラーが発生しました</h2>
            <p>金価格の取得中にエラーが発生しました。</p>
            <div style="background-color: #f8d7da; padding: 10px; margin: 10px 0;">
                <pre>{error_message}</pre>
            </div>
            <p>時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </body>
        </html>
        """
        return self.send_email(recipient_email, subject, body, html=True)