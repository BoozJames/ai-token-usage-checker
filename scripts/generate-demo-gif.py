from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT = 960, 540
BACKGROUND = "#181818"
EDITOR = "#1f1f1f"
PANEL = "#252526"
BORDER = "#3c3c3c"
TEXT = "#f0f0f0"
MUTED = "#a8a8a8"
BLUE = "#3794ff"
GREEN = "#45b97c"
STATUS = "#181818"


def font(size, bold=False):
    windows = Path("C:/Windows/Fonts")
    candidates = [
        windows / ("seguisb.ttf" if bold else "segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_13 = font(13)
FONT_14 = font(14)
FONT_15 = font(15)
FONT_16 = font(16)
FONT_18_B = font(18, True)
FONT_22_B = font(22, True)
FONT_28_B = font(28, True)


def base(step):
    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 34), fill="#202020")
    draw.text((16, 9), "File    Edit    Selection    View    Go    Run    Terminal    Help", font=FONT_13, fill=MUTED)
    draw.rectangle((0, 34, 48, HEIGHT - 24), fill="#181818")
    for y in (58, 100, 142, 184, 226):
        draw.rounded_rectangle((14, y, 34, y + 20), radius=4, outline="#777777", width=2)
    draw.rectangle((48, 34, WIDTH, HEIGHT - 24), fill=EDITOR)
    draw.rectangle((48, 34, WIDTH, 70), fill="#252526")
    draw.text((70, 45), "AI Token Checker", font=FONT_14, fill=TEXT)
    draw.rectangle((0, HEIGHT - 24, WIDTH, HEIGHT), fill=STATUS)
    draw.text((20, HEIGHT - 19), "main", font=FONT_13, fill=MUTED)
    draw.rounded_rectangle((760, 7, 938, 29), radius=11, fill="#2d2d30")
    draw.text((776, 11), step, font=FONT_13, fill=TEXT)
    return image, draw


def status_item(draw, active=False):
    box = (758, HEIGHT - 23, 952, HEIGHT - 1)
    if active:
        draw.rectangle(box, fill="#094771")
    draw.ellipse((770, HEIGHT - 17, 780, HEIGHT - 7), outline=GREEN, width=2)
    draw.text((786, HEIGHT - 20), "Codex 32% remaining", font=FONT_13, fill=TEXT)


def draw_meter(draw, box, percent):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=5, fill="#30363d")
    fill_x = x1 + int((x2 - x1) * percent / 100)
    draw.rounded_rectangle((x1, y1, fill_x, y2), radius=5, fill=GREEN)


def hover_frame():
    image, draw = base("1  Hover for usage")
    draw.text((90, 112), "Your quota at a glance", font=FONT_28_B, fill=TEXT)
    draw.text((90, 154), "No sidebar. No extra navigation.", font=FONT_16, fill=MUTED)
    status_item(draw, True)
    box = (566, 226, 942, 500)
    draw.rounded_rectangle(box, radius=10, fill=PANEL, outline=BORDER, width=1)
    draw.text((590, 246), "Codex usage", font=FONT_22_B, fill=TEXT)
    draw.text((590, 286), "68% used  |  32% remaining", font=FONT_18_B, fill=TEXT)
    draw.text((590, 318), "5-hour limit  |  resets in 2h", font=FONT_15, fill=MUTED)
    draw.text((590, 355), "Quota windows", font=FONT_15, fill=TEXT)
    draw.text((604, 382), "•  5-hour: 68% used", font=FONT_14, fill=MUTED)
    draw.text((604, 408), "•  Weekly: 11% used", font=FONT_14, fill=MUTED)
    draw.text((590, 444), "Tokens: 1,130,562", font=FONT_14, fill=MUTED)
    draw.text((590, 472), "Updated just now", font=FONT_13, fill="#8ec07c")
    return image


def picker_frame():
    image, draw = base("2  Click to choose")
    status_item(draw, True)
    box = (245, 88, 815, 454)
    draw.rounded_rectangle(box, radius=10, fill=PANEL, outline="#555555", width=1)
    draw.text((270, 108), "AI Token Checker - Codex", font=FONT_18_B, fill=TEXT)
    draw.rounded_rectangle((266, 142, 794, 180), radius=5, fill="#04395e", outline=BLUE)
    draw.text((282, 151), "Codex", font=FONT_16, fill=TEXT)
    draw.text((662, 151), "Current  |  Connected", font=FONT_13, fill="#c9e5ff")
    draw.text((282, 184), "68% used  |  32% remaining  |  5-hour limit", font=FONT_13, fill=MUTED)
    draw.text((270, 221), "OTHER PROVIDERS", font=FONT_13, fill="#8e8e8e")
    draw.line((266, 242, 794, 242), fill=BORDER)
    draw.text((282, 253), "Claude Code", font=FONT_15, fill=TEXT)
    draw.text((282, 285), "GitHub Copilot", font=FONT_15, fill=TEXT)
    draw.text((270, 326), "CODEX ACTIONS", font=FONT_13, fill="#8e8e8e")
    draw.line((266, 347, 794, 347), fill=BORDER)
    draw.text((282, 359), "Refresh Codex", font=FONT_15, fill=TEXT)
    draw.rounded_rectangle((266, 390, 794, 430), radius=4, fill="#333333")
    draw.text((282, 400), "Open usage details", font=FONT_15, fill=TEXT)
    return image


def details_frame():
    image, draw = base("3  Open full details")
    status_item(draw)
    draw.rectangle((48, 34, WIDTH, 70), fill="#252526")
    draw.rectangle((48, 68, 292, 70), fill=BLUE)
    draw.text((70, 45), "AI Token Checker - Codex", font=FONT_14, fill=TEXT)
    draw.text((118, 104), "Codex", font=FONT_28_B, fill=TEXT)
    card = (118, 150, 842, 322)
    draw.rounded_rectangle(card, radius=10, fill=PANEL, outline=BORDER, width=1)
    draw.text((144, 176), "68% used  |  32% remaining", font=FONT_22_B, fill=TEXT)
    draw.text((144, 214), "5-hour limit", font=FONT_16, fill=MUTED)
    draw.text((690, 214), "Resets in 2h", font=FONT_14, fill=MUTED)
    draw_meter(draw, (144, 258, 816, 270), 68)
    draw.text((118, 354), "Usage details", font=FONT_18_B, fill=TEXT)
    draw.text((138, 391), "•  5-hour limit: 68% used  |  32% remaining", font=FONT_15, fill=MUTED)
    draw.text((138, 421), "•  Weekly limit: 11% used  |  89% remaining", font=FONT_15, fill=MUTED)
    draw.text((118, 462), "Lifetime tokens: 1,130,562", font=FONT_14, fill=MUTED)
    draw.text((654, 462), "Updated just now", font=FONT_13, fill="#8ec07c")
    return image


output = Path(__file__).resolve().parents[1] / "media" / "usage-workflow.gif"
frames = [hover_frame(), picker_frame(), details_frame()]
frames[0].save(
    output,
    save_all=True,
    append_images=frames[1:],
    duration=[1900, 2100, 2500],
    loop=0,
    optimize=True,
    disposal=2,
)
print(f"Generated {output} ({output.stat().st_size / 1024:.1f} KB)")
