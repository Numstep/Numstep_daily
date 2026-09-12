import json
from datetime import date
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
W, H = A4
FOOTER = "a puzzle by Ben Cornish"
RULES = {
    "classic": ["Start at the coloured clue and follow the numbered chain in order.", "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.", "The highest-numbered clue completes the chain and may be the terminal square.", "Adjacency is the ordinary four-way grid. There is no wrap-around at the edges."],
    "cube": ["Start at the coloured clue and follow the numbered chain in order across the cube.", "Move between cells that share a face. This includes moving within a layer or between adjacent layers. Diagonal, edge-only and corner-only contacts do not count. Black cells are blocked, and you cannot use a cell more than once.", "The highest-numbered clue completes the chain and may be the terminal cell.", "Adjacency is three-dimensional six-way face adjacency: above, below, left, right, forward and back."],
    "torus": ["Start at the coloured clue and follow the numbered chain in order.", "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.", "The highest-numbered clue completes the chain and may be the terminal square.", "The grid wraps around both directions: the left edge is adjacent to the right edge, and the top edge is adjacent to the bottom edge."],
    "box": ["Start at the coloured clue and follow the numbered chain across the surface of the box.", "Move between cells that share an edge on a face, including across a box edge where the surface cells meet. Diagonal moves and moves through the inside of the box are not allowed. Black cells are blocked, and you cannot use a cell more than once.", "The highest-numbered clue completes the chain and may be the terminal cell.", "Adjacency follows the box surface, not the flattened drawing. Each cell connects to its four surface neighbours, with face-to-face transitions handled at the box edges."]}
TITLES = {"classic":"Numstep: Classic", "cube":"Numstep: Cube", "torus":"Numstep: Torus", "box":"Numstep: Box"}

def load(path): return json.loads(path.read_text(encoding="utf-8"))

def grid2d(values, n):
    if len(values) == n and all(isinstance(row, list) for row in values): return values
    if len(values) == n*n: return [values[r*n:(r+1)*n] for r in range(n)]
    raise ValueError(f"Invalid {n}x{n} solution shape")

def wrap(c, text, x, y, width, size=7, leading=8):
    words, line = text.split(), ""; c.setFont("Helvetica", size)
    for word in words:
        test=(line+" "+word).strip()
        if c.stringWidth(test,"Helvetica",size)<=width: line=test
        else: c.drawString(x,y,line); y-=leading; line=word
    if line: c.drawString(x,y,line); y-=leading
    return y

def header(c, variant, day):
    c.setFont("Helvetica-Bold",20); c.drawCentredString(W/2,H-30,TITLES[variant])
    c.setFont("Helvetica-Oblique",8); c.drawCentredString(W/2,H-43,FOOTER)
    c.setFont("Helvetica",8); c.drawCentredString(W/2,H-55,day)

def rules(c, variant, y):
    c.setFont("Helvetica-Bold",9); c.drawCentredString(W/2,y,"HOW TO PLAY"); y-=12
    for text in RULES[variant]: y=wrap(c,text,36,y,W-72); y-=3
    return y

def grid(c, values, x, y, size, title, solution=False, rotate=False):
    n=len(values); cell=size/n; c.saveState()
    if rotate: c.translate(x+size/2,y+size/2); c.rotate(180); x,y=-size/2,-size/2
    c.setFont("Helvetica-Bold",7 if solution else 9); c.drawCentredString(x+size/2,y+size+(5 if solution else 7),title)
    c.setLineWidth(.2 if solution else .5)
    for r in range(n):
        for col in range(n):
            value=values[r][col]; px=x+col*cell; py=y+(n-r-1)*cell
            if value==0: c.setFillColorRGB(0,0,0); c.rect(px,py,cell,cell,fill=1,stroke=0)
            c.setStrokeColorRGB(0,0,0); c.rect(px,py,cell,cell,fill=0,stroke=1)
            if value and (solution or value==1 or value%10==0):
                fs=3 if solution else max(4,min(15,cell*.34)); c.setFont("Helvetica" if solution else "Helvetica-Bold",fs); c.drawCentredString(px+cell/2,py+cell*.34,str(value))
    c.restoreState()

def planar(variant, day, out):
    folder="numstep" if variant=="classic" else "numstep-taurus"; grids=[]
    for n in (5,7,9): grids.append(grid2d(load(ROOT/"games"/folder/"data"/f"{n}x{n}"/f"{day}.json")["solution"],n))
    c=canvas.Canvas(str(out),pagesize=A4); header(c,variant,day); y=rules(c,variant,H-70)
    small,gap=145,46; left=(W-2*small-gap)/2; sy=y-small-18
    grid(c,grids[0],left,sy,small,"5 x 5"); grid(c,grids[1],left+small+gap,sy,small,"7 x 7")
    large=255; grid(c,grids[2],(W-large)/2,sy-large-52,large,"9 x 9")
    ss,sg=48,10; sx=(W-3*ss-2*sg)/2
    for i,n in enumerate((5,7,9)): grid(c,grids[i],sx+i*(ss+sg),30,ss,f"{n} x {n}",True,True)
    c.setFont("Helvetica-Oblique",8); c.drawCentredString(W/2,14,FOOTER); c.save()

def cube(day,out):
    data=load(ROOT/"games/numstep-cube/data"/f"{day}.json"); c=canvas.Canvas(str(out),pagesize=A4); header(c,"cube",day); y=rules(c,"cube",H-70)
    size,gx,gy=185,32,30; left=(W-2*size-gx)/2; top=y-size-16
    layers=data["solution"]
    positions=[(left,top),(left+size+gx,top),(left,top-size-gy)]
    for i,(x,py) in enumerate(positions): grid(c,layers[i],x,py,size,f"Layer {i+1}")
    ss,sg=78,12; sx=(W-3*ss-2*sg)/2
    for i,layer in enumerate(layers): grid(c,layer,sx+i*(ss+sg),35,ss,f"Layer {i+1}",True,True)
    c.setFont("Helvetica-Oblique",8); c.drawCentredString(W/2,14,FOOTER); c.save()

def draw_box_faces(c,faces,x,y,face,upside_down):
    c.saveState()
    if upside_down: c.translate(x+2*face,y+1.5*face); c.rotate(180); x,y=-2*face,-1.5*face
    pos={"TOP":(1,0),"LEFT":(0,1),"FRONT":(1,1),"RIGHT":(2,1),"BACK":(3,1),"BOTTOM":(1,2)}; cell=face/3
    for name,(gx,gy) in pos.items():
        ox,oy=x+gx*face,y+(2-gy)*face
        for r in range(3):
            for col in range(3):
                value=faces[name][r][col]; px,py=ox+col*cell,oy+(2-r)*cell
                if value==0: c.setFillColorRGB(0,0,0); c.rect(px,py,cell,cell,fill=1,stroke=0)
                c.setStrokeColorRGB(0,0,0); c.rect(px,py,cell,cell,fill=0,stroke=1)
                if value and (upside_down or value==1 or value%10==0): c.setFont("Helvetica" if upside_down else "Helvetica-Bold",3 if upside_down else 7); c.drawCentredString(px+cell/2,py+cell*.34,str(value))
    c.restoreState()

def box(day,out):
    faces=load(ROOT/"games/numstep-box/data"/f"{day}.json")["faces"]; c=canvas.Canvas(str(out),pagesize=A4); header(c,"box",day); y=rules(c,"box",H-70)
    face=100; nx=(W-4*face)/2; ny=y-3*face-20; draw_box_faces(c,faces,nx,ny,face,False)
    sf=48; sx=(W-4*sf)/2; draw_box_faces(c,faces,sx,35,sf,True); c.setFont("Helvetica-Bold",7); c.drawCentredString(W/2,35+3*sf+7,"SOLUTION")
    c.setFont("Helvetica-Oblique",8); c.drawCentredString(W/2,14,FOOTER); c.save()

def main():
    day=date.today().isoformat(); jobs=[("classic",ROOT/"games/numstep/printables"/f"{day}.pdf"),("cube",ROOT/"games/numstep-cube/printables"/f"{day}.pdf"),("torus",ROOT/"games/numstep-taurus/printables"/f"{day}.pdf"),("box",ROOT/"games/numstep-box/printables"/f"{day}.pdf")]
    for variant,out in jobs:
        out.parent.mkdir(parents=True,exist_ok=True)
        if variant=="cube": cube(day,out)
        elif variant=="box": box(day,out)
        else: planar(variant,day,out)
        print(f"Generated {variant} printable: {out}")

if __name__=="__main__": main()
