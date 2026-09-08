from pathlib import Path
p=Path('seed/verified-max-tour-data.sql')
s=p.read_text()
old_cable='https://travelviet.net/cdn-cgi/image/width%3D1100%2Cquality%3D60%2Cmetadata%3Dnone%2Cheight%3D500%2Cfit%3Dcover%2Cformat%3Dauto/https%3A/images.travelviet.net/vietnam/s3/s3_amazon/1d0640f9-ae39-483c-b06f-1c30eec93899-doi-robin-ngam-nhin-toan-canh-da-lat-tho-mong-tu-tren-cao-06-1634643554jpeg20241104051905.jpeg'
glass='https://letravel.vn/uploaded/Anh-Cam-NangDL/cn-dl-da-lat/thamquancaukinhnganthongtaixusohoadalat4.jpg'
do='https://bizweb.dktcdn.net/100/416/263/files/nha-hat-do-nha-trang-1.jpg?v=1741848232627'
honchong='https://static.vinwonders.com/2022/08/hon-chong-promontory-5-1.jpg'
lines=s.splitlines()
out=[]
for line in lines:
    if "WHERE id='dalat-vip';" in line and old_cable in line:
        line=line.replace(',\\"'+old_cable+'\\"', '')
    if "WHERE id='dalat-glass';" in line and old_cable in line:
        line=line.replace(old_cable,glass)
    if "WHERE id='nha-day';" in line and do in line:
        line=line.replace(do,honchong)
    out.append(line)
p.write_text('\n'.join(out)+'\n')
print('itinerary exact gallery correction applied')
